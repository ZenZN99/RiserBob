import { afterEach, describe, expect, it } from 'bun:test'
import type { Router } from '../../src/routing/router'
import { HttpServer } from '../../src/server/http-server'

type TestHandler = (
	spongReq: any,
	spongRes: any
) => Response | Promise<Response> | undefined | Promise<undefined>

function createRouter(handler?: TestHandler, allowedMethods: string[] = []) {
	const router = {
		match: () =>
			handler
				? {
						handler,
						params: {}
					}
				: null,

		allowedMethods: () => allowedMethods
	}

	return router as unknown as Router
}

describe('HttpServer', () => {
	const servers: ReturnType<typeof HttpServer>[] = []

	function startServer(router: Router, callback?: () => void) {
		const server = HttpServer(router, 0, callback)
		servers.push(server)
		return server
	}

	afterEach(() => {
		for (const server of servers.splice(0)) {
			server.stop(true)
		}
	})

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

	it('should return the handler Response', async () => {
		const router = createRouter(() =>
			Response.json({ message: 'Hello RiserBob' })
		)

		const server = startServer(router)
		const response = await fetch(new URL('/', server.url))
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body).toEqual({
			message: 'Hello RiserBob'
		})
	})

	it('should return 404 when the route does not exist', async () => {
		const router = createRouter()

		const server = startServer(router)
		const response = await fetch(new URL('/missing', server.url))
		const body = await response.json()

		expect(response.status).toBe(404)
		expect(body).toEqual({
			error: 'Not Found'
		})
	})

	// Requires the Allow header to be added in http-server.ts (see patch).
	it('should return 405 and the Allow header', async () => {
		const router = createRouter(undefined, ['GET', 'PUT'])

		const server = startServer(router)
		const response = await fetch(new URL('/users', server.url), {
			method: 'POST'
		})
		const body = await response.json()

		expect(response.status).toBe(405)
		expect(response.headers.get('Allow')).toBe('GET, PUT')
		expect(body).toEqual({
			error: 'Method Not Allowed'
		})
	})

	it('should return 500 when the handler does not return a Response', async () => {
		const router = createRouter(async () => undefined)

		const server = startServer(router)
		const response = await fetch(new URL('/', server.url))
		const body = await response.json()

		// ErrorHandler hides internal error messages from clients.
		expect(response.status).toBe(500)
		expect(body).toEqual({
			error: 'Internal Server Error'
		})
	})

	it('should return 500 when the handler throws an error', async () => {
		const router = createRouter(() => {
			throw new Error('Test error')
		})

		const server = startServer(router)
		const response = await fetch(new URL('/', server.url))
		const body = await response.json()

		expect(response.status).toBe(500)
		expect(body).toEqual({
			error: 'Internal Server Error'
		})
	})

	it('should pass request information to the handler', async () => {
		const router = createRouter((spongReq) => {
			return Response.json({
				method: spongReq.method,
				path: spongReq.path,
				id: spongReq.params.id,
				query: spongReq.query.get('page')
			})
		})

		// Simulate a matched route with a dynamic parameter.
		;(router as any).match = () => ({
			handler: (spongReq: any) =>
				Response.json({
					method: spongReq.method,
					path: spongReq.path,
					id: spongReq.params.id,
					query: spongReq.query.get('page')
				}),
			params: { id: '42' }
		})

		const server = startServer(router)
		const response = await fetch(new URL('/users/42?page=2', server.url))
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
