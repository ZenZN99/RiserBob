import { SpongMethod } from '../types/spong-method'
import type { SpongMiddleware } from '../types/spong-middleware'
import type { SpongRequest } from '../types/spong-request'

export interface CorsOptions {
	/**
	 * Allowed origins.
	 * Use '*' to allow any origin only when credentials are disabled.
	 */
	origin: string | string[] | '*'

	credentials?: boolean
	methods?: string[]
	allowedHeaders?: string[]
	exposedHeaders?: string[]
	maxAge?: number
}

const DEFAULT_METHODS = [
	SpongMethod.GET,
	SpongMethod.POST,
	SpongMethod.PUT,
	SpongMethod.PATCH,
	SpongMethod.DELETE
]

const DEFAULT_ALLOWED_HEADERS = ['Content-Type', 'Authorization']

export const corsMiddleware = (
	options: CorsOptions
): SpongMiddleware<SpongRequest> => {
	const {
		origin,
		credentials = false,
		methods = DEFAULT_METHODS,
		allowedHeaders = DEFAULT_ALLOWED_HEADERS,
		exposedHeaders = [],
		maxAge = 86400
	} = options

	if (origin === '*' && credentials) {
		throw new TypeError(
			'[RiserBob] CORS cannot use "*" with credentials enabled.'
		)
	}

	if (!Array.isArray(methods) || methods.length === 0) {
		throw new TypeError(
			'[RiserBob] CORS methods must contain at least one method.'
		)
	}

	if (!Array.isArray(allowedHeaders)) {
		throw new TypeError('[RiserBob] CORS allowedHeaders must be an array.')
	}

	if (!Array.isArray(exposedHeaders)) {
		throw new TypeError('[RiserBob] CORS exposedHeaders must be an array.')
	}

	if (!Number.isInteger(maxAge) || maxAge < 0) {
		throw new TypeError(
			'[RiserBob] CORS maxAge must be a non-negative integer.'
		)
	}

	const allowedOrigins = new Set(Array.isArray(origin) ? origin : [])

	const allowedMethods = methods.join(', ')
	const allowedRequestHeaders = allowedHeaders.join(', ')
	const exposedResponseHeaders = exposedHeaders.join(', ')

	return async (spongReq, spongRes, spongNext) => {
		const requestOrigin = spongReq.request.headers.get('origin')

		const headers = new Headers()

		const originAllowed =
			origin === '*'
				? true
				: (requestOrigin !== null &&
						allowedOrigins.has(requestOrigin)) ||
					(typeof origin === 'string' &&
						origin !== '*' &&
						requestOrigin === origin)

		if (originAllowed) {
			headers.set(
				'Access-Control-Allow-Origin',
				origin === '*' ? '*' : requestOrigin!
			)

			if (credentials) {
				headers.set('Access-Control-Allow-Credentials', 'true')
			}

			headers.set('Access-Control-Allow-Methods', allowedMethods)

			if (allowedHeaders.length > 0) {
				headers.set(
					'Access-Control-Allow-Headers',
					allowedRequestHeaders
				)
			}

			if (exposedHeaders.length > 0) {
				headers.set(
					'Access-Control-Expose-Headers',
					exposedResponseHeaders
				)
			}

			headers.set('Access-Control-Max-Age', String(maxAge))

			if (origin !== '*') {
				headers.set('Vary', 'Origin')
			}
		}

		// Handle CORS preflight before routing.
		if (spongReq.method === SpongMethod.OPTIONS) {
			return new Response(null, {
				status: 204,
				headers
			})
		}

		const response = await spongNext()
		const responseHeaders = new Headers(response.headers)

		for (const [name, value] of headers) {
			if (name.toLowerCase() === 'vary') {
				const existing = responseHeaders.get('Vary')
				const values = existing
					? existing.split(',').map((item) => item.trim())
					: []

				if (!values.some((value) => value.toLowerCase() === 'origin')) {
					values.push('Origin')
				}

				responseHeaders.set('Vary', values.join(', '))
			} else {
				responseHeaders.set(name, value)
			}
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders
		})
	}
}
