import { createHmac, timingSafeEqual } from 'node:crypto'
import { parseCookie, stringifySetCookie } from 'cookie'

export type SameSite = boolean | 'lax' | 'strict' | 'none'

export type CookiePriority = 'low' | 'medium' | 'high'

export interface CookieOptions {
	domain?: string
	path?: string
	expires?: Date
	maxAge?: number
	httpOnly?: boolean
	secure?: boolean
	sameSite?: SameSite
	priority?: CookiePriority
	partitioned?: boolean
}

/**
 * Attributes that must match the original cookie for the browser to
 * actually remove it.
 */
export type CookieDeleteOptions = Pick<
	CookieOptions,
	'domain' | 'path' | 'secure' | 'sameSite' | 'partitioned'
>

export interface CookieManagerOptions {
	/**
	 * Secrets used by setSigned/getSigned. The first secret signs new
	 * cookies, every secret is accepted when verifying (key rotation).
	 * Each secret must be at least 32 characters long.
	 */
	secrets?: readonly string[]

	/**
	 * Defaults applied to every cookie. The built-in defaults are
	 * `Path=/; HttpOnly; Secure; SameSite=Lax`. Use `{ secure: false }`
	 * for plain-HTTP local development (Safari rejects Secure cookies on
	 * http://localhost).
	 */
	defaults?: CookieOptions

	/**
	 * Largest `Cookie` request header (in bytes) that will be parsed.
	 * Larger headers are ignored instead of being processed.
	 * Default: 16 KB.
	 */
	maxHeaderBytes?: number
}

export type CookieErrorCode =
	| 'INVALID_NAME'
	| 'INVALID_VALUE'
	| 'INVALID_OPTION'
	| 'COOKIE_TOO_LARGE'
	| 'SERIALIZATION_FAILED'
	| 'SECRETS_REQUIRED'
	| 'WEAK_SECRET'

/**
 * Thrown for programmer mistakes (bad name, bad option, oversized cookie,
 * missing secret). Reading cookies never throws.
 */
export class CookieError extends Error {
	constructor(
		public readonly code: CookieErrorCode,
		message: string,
		options?: ErrorOptions
	) {
		super(message, options)
		this.name = 'CookieError'
	}
}

const SECURE_DEFAULTS: CookieOptions = Object.freeze({
	path: '/',
	httpOnly: true,
	secure: true,
	sameSite: 'lax'
})

/** Browsers cap the whole Set-Cookie line (name + value + attributes). */
const MAX_COOKIE_BYTES = 4096
/** Chrome caps cookie lifetime at 400 days, so we do the same everywhere. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60
const DEFAULT_MAX_HEADER_BYTES = 16 * 1024
const MIN_SECRET_LENGTH = 32

const NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const PATH_RE = /^\/[\x20-\x3A\x3C-\x7E]*$/
const DOMAIN_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const DOMAIN_RE = new RegExp(
	`^\\.?${DOMAIN_LABEL}(?:\\.${DOMAIN_LABEL})*$`,
	'i'
)

const SAME_SITE_VALUES = new Set<SameSite>(['lax', 'strict', 'none'])
const PRIORITY_VALUES = new Set<CookiePriority>(['low', 'medium', 'high'])

function definedOnly<T extends object>(source: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(source).filter(([, value]) => value !== undefined)
	) as Partial<T>
}

function sign(name: string, value: string, secret: string): string {
	// The name is part of the signed payload, so a valid cookie cannot be
	// copied under a different name.
	return createHmac('sha256', secret)
		.update(`${name}=${value}`)
		.digest('base64url')
}

export class CookieManager {
	/** Current view: request cookies plus the changes made during this request. */
	private readonly cookies = new Map<string, string>()
	/** Set-Cookie lines to send, one per (name, domain, path, partitioned). */
	private readonly pending = new Map<string, string>()
	private readonly secrets: readonly string[]
	private readonly defaults: CookieOptions

	/** True when the incoming Cookie header was ignored for being too large. */
	readonly headerRejected: boolean

	constructor(
		cookieHeader?: string | null,
		options: CookieManagerOptions = {}
	) {
		const secrets = options.secrets ?? []

		for (const secret of secrets) {
			if (
				typeof secret !== 'string' ||
				secret.length < MIN_SECRET_LENGTH
			) {
				throw new CookieError(
					'WEAK_SECRET',
					`Cookie secrets must be strings of at least ${MIN_SECRET_LENGTH} characters.`
				)
			}
		}

		this.secrets = [...secrets]
		this.defaults = definedOnly(options.defaults ?? {})

		// Fail fast on contradictory defaults instead of on the first request.
		this.resolveOptions('probe', {})

		const maxHeaderBytes =
			options.maxHeaderBytes ?? DEFAULT_MAX_HEADER_BYTES
		let rejected = false

		if (typeof cookieHeader === 'string' && cookieHeader !== '') {
			if (Buffer.byteLength(cookieHeader, 'utf8') > maxHeaderBytes) {
				rejected = true
			} else {
				this.load(cookieHeader)
			}
		}

		this.headerRejected = rejected
	}

	static fromRequest(
		request: Request,
		options?: CookieManagerOptions
	): CookieManager {
		return new CookieManager(request.headers.get('cookie'), options)
	}

	get(name: string): string | undefined {
		return this.cookies.get(name)
	}

	has(name: string): boolean {
		return this.cookies.has(name)
	}

	names(): string[] {
		return [...this.cookies.keys()]
	}

	getAll(): Readonly<Record<string, string>> {
		return Object.fromEntries(this.cookies)
	}

	set(name: string, value: string, options: CookieOptions = {}): this {
		const resolved = this.resolveOptions(name, options)
		const serialized = this.serialize(name, value, resolved)

		// Everything above can throw; state is only touched once it all passed.
		this.record(name, resolved, serialized)

		if (this.isExpired(resolved)) {
			this.cookies.delete(name)
		} else {
			this.cookies.set(name, value)
		}

		return this
	}

	/**
	 * Sets a tamper-proof cookie (HMAC-SHA256). The value stays readable by
	 * the client, it just cannot be changed without being detected.
	 */
	setSigned(name: string, value: string, options: CookieOptions = {}): this {
		const secret = this.secrets[0]

		if (secret === undefined) {
			throw new CookieError(
				'SECRETS_REQUIRED',
				'Signed cookies need at least one secret in CookieManagerOptions.secrets.'
			)
		}

		if (typeof value !== 'string') {
			throw new CookieError(
				'INVALID_VALUE',
				'Cookie value must be a string.'
			)
		}

		return this.set(name, `${value}.${sign(name, value, secret)}`, options)
	}

	/**
	 * Returns the original value, or undefined when the cookie is missing,
	 * unsigned, tampered with, or signed with an unknown secret.
	 */
	getSigned(name: string): string | undefined {
		const raw = this.cookies.get(name)

		if (raw === undefined) return undefined

		const separator = raw.lastIndexOf('.')

		if (separator === -1) return undefined

		const value = raw.slice(0, separator)
		const provided = Buffer.from(raw.slice(separator + 1), 'utf8')

		// Check every secret without stopping early.
		let valid = false

		for (const secret of this.secrets) {
			const expected = Buffer.from(sign(name, value, secret), 'utf8')

			if (
				provided.length === expected.length &&
				timingSafeEqual(provided, expected)
			) {
				valid = true
			}
		}

		return valid ? value : undefined
	}

	/**
	 * Removes a cookie. Pass the same domain/path/secure/sameSite/partitioned
	 * the cookie was created with, otherwise the browser keeps it.
	 */
	delete(name: string, options: CookieDeleteOptions = {}): this {
		const resolved = this.resolveOptions(name, {
			...definedOnly(options),
			expires: new Date(0),
			maxAge: 0
		})
		const serialized = this.serialize(name, '', resolved)

		this.record(name, resolved, serialized)
		this.cookies.delete(name)

		return this
	}

	getSetCookieHeaders(): string[] {
		return [...this.pending.values()]
	}

	/**
	 * Adds the pending Set-Cookie headers to a response. Each cookie gets its
	 * own header (they must never be joined). If the response headers are
	 * immutable, a copy of the response is returned instead.
	 */
	applyTo(response: Response): Response {
		const headers = this.getSetCookieHeaders()

		if (headers.length === 0) return response

		try {
			for (const header of headers) {
				response.headers.append('Set-Cookie', header)
			}

			return response
		} catch {
			const copy = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: new Headers(response.headers)
			})

			for (const header of headers) {
				copy.headers.append('Set-Cookie', header)
			}

			return copy
		}
	}

	// Its function is to read the Cookie header coming from the browser and convert the cookies contained therein into data within `this.cookies`.
	private load(header: string): void {
		let parsed: Record<string, string | undefined>

		try {
			parsed = parseCookie(header)
		} catch {
			return
		}

		for (const [name, value] of Object.entries(parsed)) {
			if (value !== undefined) this.cookies.set(name, value)
		}
	}

	private resolveOptions(
		name: string,
		options: CookieOptions
	): CookieOptions {
		if (typeof name !== 'string' || !NAME_RE.test(name)) {
			throw new CookieError(
				'INVALID_NAME',
				`Invalid cookie name: ${JSON.stringify(name)}.`
			)
		}

		const resolved: CookieOptions = {
			...SECURE_DEFAULTS,
			...this.defaults,
			...definedOnly(options)
		}

		const invalid = (message: string): never => {
			throw new CookieError(
				'INVALID_OPTION',
				`Cookie "${name}": ${message}`
			)
		}

		if (resolved.maxAge !== undefined) {
			if (!Number.isSafeInteger(resolved.maxAge) || resolved.maxAge < 0) {
				invalid('maxAge must be a non-negative integer (seconds).')
			}

			resolved.maxAge = Math.min(
				resolved.maxAge as number,
				MAX_AGE_SECONDS
			)
		}

		if (resolved.expires !== undefined) {
			if (
				!(resolved.expires instanceof Date) ||
				Number.isNaN(resolved.expires.getTime())
			) {
				invalid('expires must be a valid Date.')
			}

			const limit = Date.now() + MAX_AGE_SECONDS * 1000

			if ((resolved.expires as Date).getTime() > limit) {
				resolved.expires = new Date(limit)
			}
		}

		if (resolved.path !== undefined && !PATH_RE.test(resolved.path)) {
			invalid(
				'path must start with "/" and not contain ";" or control characters.'
			)
		}

		if (
			resolved.domain !== undefined &&
			(resolved.domain.length > 253 || !DOMAIN_RE.test(resolved.domain))
		) {
			invalid('domain is not a valid host name.')
		}

		if (
			resolved.priority !== undefined &&
			!PRIORITY_VALUES.has(resolved.priority)
		) {
			invalid('priority must be "low", "medium" or "high".')
		}

		if (
			typeof resolved.sameSite === 'string' &&
			!SAME_SITE_VALUES.has(resolved.sameSite)
		) {
			invalid('sameSite must be "lax", "strict" or "none".')
		}

		const isHostPrefixed = name.startsWith('__Host-')
		const requiresSecure =
			isHostPrefixed ||
			name.startsWith('__Secure-') ||
			resolved.sameSite === 'none' ||
			resolved.partitioned === true

		if (requiresSecure && resolved.secure !== true) {
			invalid(
				'this cookie requires the Secure attribute ' +
					'(__Host-/__Secure- prefix, SameSite=None or Partitioned).'
			)
		}

		if (isHostPrefixed) {
			if (resolved.domain !== undefined) {
				invalid('__Host- cookies cannot set a domain.')
			}

			if (resolved.path !== '/') {
				invalid('__Host- cookies must use path "/".')
			}
		}

		return resolved
	}

	private serialize(
		name: string,
		value: string,
		resolved: CookieOptions
	): string {
		if (typeof value !== 'string') {
			throw new CookieError(
				'INVALID_VALUE',
				'Cookie value must be a string.'
			)
		}

		let serialized: string

		try {
			serialized = stringifySetCookie({ name, value, ...resolved })
		} catch (error) {
			throw new CookieError(
				'SERIALIZATION_FAILED',
				`Cookie "${name}" could not be serialized.`,
				{ cause: error }
			)
		}

		if (Buffer.byteLength(serialized, 'utf8') > MAX_COOKIE_BYTES) {
			throw new CookieError(
				'COOKIE_TOO_LARGE',
				`Cookie "${name}" is larger than ${MAX_COOKIE_BYTES} bytes.`
			)
		}

		return serialized
	}

	// In the `@riserbob/cookie` library, the `record()` function serves to register a prepared `Set-Cookie` header within the `pending` collection. It prevents duplicate entries for the same cookie (identified by its unique identity), ensuring that the most recent entry is the one that takes precedence.
	private record(
		name: string,
		resolved: CookieOptions,
		serialized: string
	): void {
		const key = [
			name,
			resolved.domain?.toLowerCase() ?? '',
			resolved.path ?? '/',
			resolved.partitioned === true ? 'partitioned' : ''
		].join('\0')

		// Last write wins, and it is sent last.
		this.pending.delete(key)
		this.pending.set(key, serialized)
	}

	private isExpired(resolved: CookieOptions): boolean {
		return (
			resolved.maxAge === 0 ||
			(resolved.expires !== undefined &&
				resolved.expires.getTime() <= Date.now())
		)
	}
}
