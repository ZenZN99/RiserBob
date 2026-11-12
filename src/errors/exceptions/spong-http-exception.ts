export type SpongErrorResponse = Record<string, unknown>
export type SpongErrorInput = string | SpongErrorResponse

export interface SpongExceptionOptions {
	/**
	 * The original error. Available as `error.cause` for logging.
	 * It is never included in the client response.
	 */
	cause?: unknown
	/**
	 * Keep the stack trace on this instance. Defaults to `true` only for 5xx.
	 * When `false`, `error.stack` holds just the "Name: message" header.
	 */
	stack?: boolean
}

/**
 * Brand used by `isSpongHttpException`. `Symbol.for` resolves to the same
 * symbol across duplicated copies of the package, and a plain object (or
 * parsed JSON) cannot carry it by accident.
 */
export const SPONG_EXCEPTION_BRAND: unique symbol = Symbol.for(
	'riserbob.spong.http-exception'
)

const GENERIC_SERVER_MESSAGE = 'Internal Server Error'

/** A usable message is a non-blank string. */
const isValidMessage = (value: unknown): value is string =>
	typeof value === 'string' && value.trim() !== ''

/**
 * Returns a copy of `input` as an object whose `message` is always a valid
 * string (falling back to `fallback`). Extra properties are preserved untouched.
 */
export const normalizeInput = (
	input: SpongErrorInput | null | undefined,
	fallback: string
): SpongErrorResponse & { message: string } => {
	if (typeof input === 'string') {
		return { message: isValidMessage(input) ? input : fallback }
	}

	const { message, ...rest } = input ?? {}
	return { message: isValidMessage(message) ? message : fallback, ...rest }
}

export class SpongHttpException extends Error {
	readonly statusCode: number
	readonly code: string
	/**
	 * Full developer-supplied payload (including `message`).
	 * Server-side only: for 5xx it may hold internal details, so send
	 * `error` / `error.toJSON()` to clients, never `error.response`.
	 */
	readonly response: SpongErrorResponse & { message: string }
	/** `true` only for 4xx: their message and payload may reach the client. */
	readonly expose: boolean

	constructor(
		statusCode: number,
		code: string,
		input: SpongErrorInput,
		options: SpongExceptionOptions = {}
	) {
		const response = normalizeInput(input, code)

		super(
			response.message,
			options.cause === undefined ? undefined : { cause: options.cause }
		)

		this.name = new.target.name
		this.statusCode = statusCode
		this.code = code
		this.response = response
		this.expose = statusCode >= 400 && statusCode < 500

		// No global state is touched. Dropping the stack also skips the lazy
		// (and expensive) formatting of the captured frames.
		if (!(options.stack ?? statusCode >= 500)) {
			this.stack = `${this.name}: ${this.message}`
		}
	}

	/** Safe, ready-to-send body: `res.json(error)` just works. */
	toJSON(): SpongErrorResponse {
		if (!this.expose) {
			return {
				message: GENERIC_SERVER_MESSAGE,
				statusCode: this.statusCode,
				code: this.code
			}
		}

		const body: SpongErrorResponse = {
			...this.response,
			statusCode: this.statusCode,
			code: this.code
		}
		delete body.cause
		return body
	}
}

Object.defineProperty(SpongHttpException.prototype, SPONG_EXCEPTION_BRAND, {
	value: true
})

export const isSpongHttpException = (
	error: unknown
): error is SpongHttpException =>
	typeof error === 'object' &&
	error !== null &&
	(error as Record<symbol, unknown>)[SPONG_EXCEPTION_BRAND] === true
