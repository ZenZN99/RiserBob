import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn
} from 'bun:test'
import type { Router } from '../../src/routing/router'
import { HttpServer } from '../../src/server/http-server'
import { ErrorMessages } from '../../src/errors/errors-messages'
import { DEFAULT_MAX_BODY_SIZE } from '../../src/http/read-request-body'
import type { SocketIOIntegration } from '../../src/types/socket-io-integration'
import type { SpongRequest } from '../../src/types/spong-request'
import type { SpongResponse } from '../../src/types/spong-response'

type TestHandler = (
	spongReq: SpongRequest,
	spongRes: SpongResponse
) => Response | Promise<Response> | undefined | Promise<undefined>

function createRouter(
	handler?: TestHandler,
	allowedMethods: string[] = [],
	params: Record<string, string> = {}
) {
	const router = {
		match: () =>
			handler
				? {
						handler,
						params
					}
				: undefined,

		allowedMethods: () => allowedMethods
	}

	return router as unknown as Router
}

// Minimal fake of the Socket.IO integration: only what HttpServer touches.
function createSocketIO(path = '/socket.io/') {
	const handleRequest = mock(
		(_request: Request, _server: unknown) => new Response('socket-io')
	)

	const integration = {
		io: {},
		path,
		engine: {
			handler: () => ({
				idleTimeout: 30,
				websocket: {
					open() {},
					message() {},
					close() {},
					maxPayloadLength: 1024
				}
			}),
			handleRequest
		}
	} as unknown as SocketIOIntegration

	return { integration, handleRequest }
}

describe('HttpServer', () => {
	const servers: ReturnType<typeof HttpServer>[] = []
	const errorMessages = new ErrorMessages()
	const spies: { mockRestore(): void }[] = []

	function startServer(
		router: Router,
		callback?: () => void,
		socketIO?: SocketIOIntegration
	) {
		const server = HttpServer(router, errorMessages, 0, callback, socketIO)
		servers.push(server)
		return server
	}

	beforeEach(() => {
		// Keep the test output clean: the server logs expected errors.
		spies.push(
			spyOn(console, 'error').mockImplementation(() => {}),
			spyOn(console, 'warn').mockImplementation(() => {})
		)
	})

	afterEach(() => {
		for (const server of servers.splice(0)) {
			server.stop(true)
		}

		for (const spy of spies.splice(0)) {
			spy.mockRestore()
		}
	})

	describe('lifecycle', () => {
		it('should start the HTTP server', () => {
			const server = startServer(createRouter())

			expect(server.port).toBeGreaterThan(0)
			expect(server.url).toBeDefined()
		})

		it('should call the callback when the server starts', () => {
			let called = false

			startServer(createRouter(), () => {
				called = true
			})

			expect(called).toBe(true)
		})
	})

	describe('routing and errors', () => {
		it('should return the handler Response', async () => {
			const router = createRouter(() =>
				Response.json({ message: 'Hello RiserBob' })
			)

			const server = startServer(router)
			const response = await fetch(new URL('/', server.url))
			const body = await response.json()

			expect(response.status).toBe(200)
			expect(body).toEqual({ message: 'Hello RiserBob' })
		})

		it('should return 404 when the route does not exist', async () => {
			const server = startServer(createRouter())
			const response = await fetch(new URL('/missing', server.url))
			const body = await response.json()

			expect(response.status).toBe(404)
			expect(body).toEqual({ error: 'Not Found' })
		})

		it('should return 405 and the Allow header', async () => {
			const router = createRouter(undefined, ['GET', 'PUT'])

			const server = startServer(router)
			const response = await fetch(new URL('/users', server.url), {
				method: 'POST'
			})
			const body = await response.json()

			expect(response.status).toBe(405)
			expect(response.headers.get('Allow')).toBe('GET, PUT')
			expect(body).toEqual({ error: 'Method Not Allowed' })
		})

		it('should return 500 when the handler does not return a Response', async () => {
			const router = createRouter(async () => undefined)

			const server = startServer(router)
			const response = await fetch(new URL('/', server.url))
			const body = await response.json()

			// ErrorHandler hides internal error messages from clients.
			expect(response.status).toBe(500)
			expect(body).toEqual({ error: 'Internal Server Error' })
		})

		it('should return 500 when the handler throws an error', async () => {
			const router = createRouter(() => {
				throw new Error('Test error')
			})

			const server = startServer(router)
			const response = await fetch(new URL('/', server.url))
			const body = await response.json()

			expect(response.status).toBe(500)
			expect(body).toEqual({ error: 'Internal Server Error' })
		})

		it('should pass request information to the handler', async () => {
			// Simulate a matched route with a dynamic parameter.
			const router = createRouter(
				(spongReq) =>
					Response.json({
						method: spongReq.method,
						path: spongReq.path,
						id: spongReq.params.id,
						query: spongReq.query.get('page')
					}),
				[],
				{ id: '42' }
			)

			const server = startServer(router)
			const response = await fetch(
				new URL('/users/42?page=2', server.url)
			)
			const body = await response.json()

			expect(response.status).toBe(200)
			expect(body).toEqual({
				method: 'GET',
				path: '/users/42',
				id: '42',
				query: '2'
			})
		})
	})

	describe('CORS preflight', () => {
		it('should answer OPTIONS with 204 and CORS headers when Origin is present', async () => {
			// No route is registered: preflight is handled before the router.
			const server = startServer(createRouter())
			const response = await fetch(new URL('/anything', server.url), {
				method: 'OPTIONS',
				headers: { Origin: 'https://example.com' }
			})

			expect(response.status).toBe(204)
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
				'https://example.com'
			)
			expect(
				response.headers.get('Access-Control-Allow-Credentials')
			).toBe('true')
			expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
				'GET, POST, PUT, PATCH, DELETE, OPTIONS'
			)
			expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
				'Content-Type, Authorization'
			)
			expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
			expect(response.headers.get('Vary')).toBe('Origin')
		})

		it('should answer OPTIONS with 204 and no CORS headers without Origin', async () => {
			const server = startServer(createRouter())
			const response = await fetch(new URL('/anything', server.url), {
				method: 'OPTIONS'
			})

			expect(response.status).toBe(204)
			expect(
				response.headers.get('Access-Control-Allow-Origin')
			).toBeNull()
		})
	})

	describe('request body', () => {
		it('should return 413 when Content-Length exceeds the limit', async () => {
			const router = createRouter(() => new Response('OK'))
			const server = startServer(router)

			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				body: 'x'.repeat(DEFAULT_MAX_BODY_SIZE + 1)
			})
			const body = await response.json()

			expect(response.status).toBe(413)
			expect(body).toEqual({ error: 'Content Too Large' })
		})

		it('should parse a JSON body', async () => {
			const router = createRouter(async (spongReq) =>
				Response.json({ received: await spongReq.json() })
			)
			const server = startServer(router)

			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Bob' })
			})

			expect(response.status).toBe(200)
			expect(await response.json()).toEqual({
				received: { name: 'Bob' }
			})
		})

		it('should return 400 for an invalid JSON body', async () => {
			const router = createRouter(async (spongReq) =>
				Response.json(await spongReq.json())
			)
			const server = startServer(router)

			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{ not json'
			})

			expect(response.status).toBe(400)
			expect(await response.json()).toEqual({
				error: 'Invalid JSON body'
			})
		})

		it('should reject json() when the Content-Type is not JSON', async () => {
			const router = createRouter(async (spongReq) =>
				Response.json(await spongReq.json())
			)
			const server = startServer(router)

			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain' },
				body: '{"a":1}'
			})

			// The exact status comes from requireJsonContentType (4xx).
			expect(response.status).toBeGreaterThanOrEqual(400)
			expect(response.status).toBeLessThan(500)
		})

		it('should read a text body', async () => {
			const router = createRouter(async (spongReq) =>
				Response.json({ text: await spongReq.text() })
			)
			const server = startServer(router)

			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				body: 'hello bob'
			})

			expect(await response.json()).toEqual({ text: 'hello bob' })
		})

		it('should parse a form data body', async () => {
			const router = createRouter(async (spongReq) => {
				const form = await spongReq.formData()
				return Response.json({ name: form.get('name') })
			})
			const server = startServer(router)

			const form = new FormData()
			form.set('name', 'Bob')

			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				body: form
			})

			expect(response.status).toBe(200)
			expect(await response.json()).toEqual({ name: 'Bob' })
		})

		it('should return 400 when formData() has no Content-Type', async () => {
			const router = createRouter(async (spongReq) => {
				await spongReq.formData()
				return new Response('OK')
			})
			const server = startServer(router)

			// A Uint8Array body is sent without a Content-Type header.
			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				body: new Uint8Array([1, 2, 3])
			})

			expect(response.status).toBe(400)
			expect(await response.json()).toEqual({
				error: 'Missing Content-Type'
			})
		})

		it('should return 400 for invalid form data', async () => {
			const router = createRouter(async (spongReq) => {
				await spongReq.formData()
				return new Response('OK')
			})
			const server = startServer(router)

			const response = await fetch(new URL('/', server.url), {
				method: 'POST',
				headers: {
					'Content-Type': 'multipart/form-data; boundary=missing'
				},
				body: 'this is not multipart'
			})

			expect(response.status).toBe(400)
			expect(await response.json()).toEqual({
				error: 'Invalid form data'
			})
		})
	})

	describe('Socket.IO', () => {
		it('should route the Socket.IO path to the engine', async () => {
			const { integration, handleRequest } = createSocketIO()
			const router = createRouter(() => new Response('http'))
			const server = startServer(router, undefined, integration)

			const response = await fetch(new URL('/socket.io/', server.url))

			expect(await response.text()).toBe('socket-io')
			expect(handleRequest).toHaveBeenCalledTimes(1)
		})

		it('should ignore trailing slashes when matching the path', async () => {
			const { integration, handleRequest } = createSocketIO('/socket.io/')
			const server = startServer(
				createRouter(() => new Response('http')),
				undefined,
				integration
			)

			const response = await fetch(new URL('/socket.io', server.url))

			expect(await response.text()).toBe('socket-io')
			expect(handleRequest).toHaveBeenCalledTimes(1)
		})

		it('should not route other paths to the engine', async () => {
			const { integration, handleRequest } = createSocketIO()
			const server = startServer(
				createRouter(() => new Response('http')),
				undefined,
				integration
			)

			const response = await fetch(new URL('/users', server.url))

			expect(await response.text()).toBe('http')
			expect(handleRequest).not.toHaveBeenCalled()
		})

		it('should not intercept the Socket.IO path when it is disabled', async () => {
			const server = startServer(createRouter(() => new Response('http')))

			const response = await fetch(new URL('/socket.io/', server.url))

			expect(await response.text()).toBe('http')
		})
	})
})
