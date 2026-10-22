import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { SpongMethod } from '../../../src/types/spong-method'
import type { SpongMiddleware } from '../../../src/types/spong-middleware'
import type { SpongRequest } from '../../../src/types/spong-request'
import type { SpongResponse } from '../../../src/types/spong-response'
import { corsMiddleware } from '../../../src/middleware/cors-middleware'

describe('corsMiddleware', () => {
	const originalConsoleError = console.error

	afterEach(() => {
		console.error = originalConsoleError
	})

	const createRequest = (
		method: string = SpongMethod.GET,
		origin?: string,
		headers: Record<string, string> = {}
	): SpongRequest => {
		const requestHeaders = new Headers(headers)

		if (origin) {
			requestHeaders.set('origin', origin)
		}

		const request = new Request('http://localhost/users', {
			method,
			headers: requestHeaders
		})

		return {
			request,
			method,
			path: '/users',
			headers: request.headers
		} as SpongRequest
	}

	const createResponse = (): SpongResponse => ({}) as SpongResponse

	const createNext = (
		response: Response = Response.json({ success: true })
	) => mock(async () => response)

	const execute = (
		middleware: SpongMiddleware<SpongRequest>,
		request: SpongRequest,
		next: () => Promise<Response> = createNext()
	) => middleware(request, createResponse(), next)

	it('should reject wildcard origin when credentials are enabled', () => {
		expect(() =>
			corsMiddleware({ origin: '*', credentials: true })
		).toThrow('[RiserBob] CORS cannot use "*" with credentials enabled.')
	})

	it('should reject an empty methods array', () => {
		expect(() => corsMiddleware({ origin: '*', methods: [] })).toThrow(
			'[RiserBob] CORS methods must contain at least one method.'
		)
	})

	it('should reject non-array allowedHeaders', () => {
		expect(() =>
			corsMiddleware({
				origin: '*',
				allowedHeaders: null as unknown as string[]
			})
		).toThrow('[RiserBob] CORS allowedHeaders must be an array.')
	})

	it('should reject non-array exposedHeaders', () => {
		expect(() =>
			corsMiddleware({
				origin: '*',
				exposedHeaders: null as unknown as string[]
			})
		).toThrow('[RiserBob] CORS exposedHeaders must be an array.')
	})

	it('should reject a negative maxAge', () => {
		expect(() => corsMiddleware({ origin: '*', maxAge: -1 })).toThrow(
			'[RiserBob] CORS maxAge must be a non-negative integer.'
		)
	})

	it('should reject a non-integer maxAge', () => {
		expect(() => corsMiddleware({ origin: '*', maxAge: 1.5 })).toThrow(
			'[RiserBob] CORS maxAge must be a non-negative integer.'
		)
	})

	it('should allow any origin when origin is wildcard', async () => {
		const next = createNext()
		const middleware = corsMiddleware({ origin: '*' })

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://example.com'),
			next
		)

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
		expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
			'GET, POST, PUT, PATCH, DELETE'
		)
		expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
			'Content-Type, Authorization'
		)
		expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
		expect(response.status).toBe(200)
		expect(next).toHaveBeenCalledTimes(1)
	})

	it('should allow a configured origin and set Vary: Origin', async () => {
		const middleware = corsMiddleware({
			origin: 'https://example.com'
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://example.com')
		)

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
			'https://example.com'
		)
		expect(response.headers.get('Vary')).toBe('Origin')
	})

	it('should allow an origin from the configured origin list', async () => {
		const middleware = corsMiddleware({
			origin: ['https://example.com', 'https://app.example.com']
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://app.example.com')
		)

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
			'https://app.example.com'
		)
	})

	it('should not set CORS allow-origin for an unconfigured origin', async () => {
		const next = createNext()
		const middleware = corsMiddleware({
			origin: 'https://example.com'
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://evil.example'),
			next
		)

		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
		expect(response.status).toBe(200)
		expect(next).toHaveBeenCalledTimes(1)
	})

	it('should set credentials header when enabled', async () => {
		const middleware = corsMiddleware({
			origin: 'https://example.com',
			credentials: true
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://example.com')
		)

		expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
			'true'
		)
	})

	it('should set configured methods and headers', async () => {
		const middleware = corsMiddleware({
			origin: 'https://example.com',
			methods: ['GET', 'POST'],
			allowedHeaders: ['Content-Type', 'X-Request-ID'],
			exposedHeaders: ['X-Total-Count'],
			maxAge: 600
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://example.com')
		)

		expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
			'GET, POST'
		)
		expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
			'Content-Type, X-Request-ID'
		)
		expect(response.headers.get('Access-Control-Expose-Headers')).toBe(
			'X-Total-Count'
		)
		expect(response.headers.get('Access-Control-Max-Age')).toBe('600')
	})

	it('should omit allow-headers when configured list is empty', async () => {
		const middleware = corsMiddleware({
			origin: '*',
			allowedHeaders: []
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET)
		)

		expect(response.headers.get('Access-Control-Allow-Headers')).toBeNull()
	})

	it('should omit expose-headers when configured list is empty', async () => {
		const middleware = corsMiddleware({
			origin: '*',
			exposedHeaders: []
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET)
		)

		expect(response.headers.get('Access-Control-Expose-Headers')).toBeNull()
	})

	it('should return 204 for OPTIONS without calling next', async () => {
		const next = createNext()
		const middleware = corsMiddleware({
			origin: 'https://example.com'
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.OPTIONS, 'https://example.com'),
			next
		)

		expect(response.status).toBe(204)
		expect(await response.text()).toBe('')
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
			'https://example.com'
		)
		expect(next).not.toHaveBeenCalled()
	})

	it('should return 204 for OPTIONS even when origin is not allowed', async () => {
		const next = createNext()
		const middleware = corsMiddleware({
			origin: 'https://example.com'
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.OPTIONS, 'https://evil.example'),
			next
		)

		expect(response.status).toBe(204)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
		expect(next).not.toHaveBeenCalled()
	})

	it('should preserve the original response status and body', async () => {
		const originalResponse = Response.json(
			{ message: 'Created' },
			{ status: 201 }
		)

		const middleware = corsMiddleware({ origin: '*' })

		const response = await execute(
			middleware,
			createRequest(SpongMethod.POST),
			createNext(originalResponse)
		)

		expect(response.status).toBe(201)
		expect(await response.json()).toEqual({ message: 'Created' })
	})

	it('should preserve existing response headers', async () => {
		const originalResponse = new Response('OK', {
			headers: {
				'X-Custom-Header': 'custom-value'
			}
		})

		const middleware = corsMiddleware({ origin: '*' })

		const response = await execute(
			middleware,
			createRequest(),
			createNext(originalResponse)
		)

		expect(response.headers.get('X-Custom-Header')).toBe('custom-value')
	})

	it('should merge Origin into an existing Vary header', async () => {
		const originalResponse = new Response('OK', {
			headers: {
				Vary: 'Accept-Encoding'
			}
		})

		const middleware = corsMiddleware({
			origin: 'https://example.com'
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://example.com'),
			createNext(originalResponse)
		)

		expect(response.headers.get('Vary')).toBe('Accept-Encoding, Origin')
	})

	it('should not duplicate Origin in an existing Vary header', async () => {
		const originalResponse = new Response('OK', {
			headers: {
				Vary: 'Accept-Encoding, Origin'
			}
		})

		const middleware = corsMiddleware({
			origin: 'https://example.com'
		})

		const response = await execute(
			middleware,
			createRequest(SpongMethod.GET, 'https://example.com'),
			createNext(originalResponse)
		)

		expect(response.headers.get('Vary')).toBe('Accept-Encoding, Origin')
	})

	it('should propagate errors thrown by next', async () => {
		const middleware = corsMiddleware({ origin: '*' })

		await expect(
			execute(middleware, createRequest(), async () => {
				throw new Error('Downstream failed')
			})
		).rejects.toThrow('Downstream failed')
	})
})
