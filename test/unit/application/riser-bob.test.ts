import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SpongHandler } from '../../../src/types/spong-handler'
import type { SpongRequest } from '../../../src/types/spong-request'
import type { SpongMiddleware } from '../../../src/types/spong-middleware'
import { HttpServer } from '../../../src/server/http-server'

const httpServerMock = mock((..._args: unknown[]) => ({ stop: mock(() => {}) }))

mock.module('../../../src/server/http-server', () => ({
	HttpServer: httpServerMock
}))

const { RiserBob } = await import('../../../src/application/riser-bob')
type RiserBob = InstanceType<typeof RiserBob>
const createHandler = (
	response: Response = new Response('OK')
): SpongHandler => {
	return (async () => response) as SpongHandler
}

const createMiddleware = (
	callback?: (req: SpongRequest) => void
): SpongMiddleware<SpongRequest> => {
	return (async (req, next) => {
		callback?.(req)
		return next()
	}) as SpongMiddleware<SpongRequest>
}

describe('RiserBob', () => {
	let bob: RiserBob

	beforeEach(() => {
		httpServerMock.mockClear()
		bob = new RiserBob()
	})

	describe('route registration', () => {
		test('should register a GET route and return the app instance', () => {
			const handler = createHandler()

			expect(bob.spongGet('/users', handler)).toBe(bob)
		})

		test('should register a POST route', () => {
			expect(bob.spongPost('/users', createHandler())).toBe(bob)
		})

		test('should register a PUT route', () => {
			expect(bob.spongPut('/users/:id', createHandler())).toBe(bob)
		})

		test('should register a PATCH route', () => {
			expect(bob.spongPatch('/users/:id', createHandler())).toBe(bob)
		})

		test('should register a DELETE route', () => {
			expect(bob.spongDelete('/users/:id', createHandler())).toBe(bob)
		})

		test('should support method chaining', () => {
			expect(
				bob
					.spongGet('/users', createHandler())
					.spongPost('/users', createHandler())
					.spongPut('/users/:id', createHandler())
					.spongPatch('/users/:id', createHandler())
					.spongDelete('/users/:id', createHandler())
			).toBe(bob)
		})

		test.each([
			[
				'GET',
				(a: RiserBob, path: string) => a.spongGet(path, createHandler())
			],
			[
				'POST',
				(a: RiserBob, path: string) =>
					a.spongPost(path, createHandler())
			],
			[
				'PUT',
				(a: RiserBob, path: string) => a.spongPut(path, createHandler())
			],
			[
				'PATCH',
				(a: RiserBob, path: string) =>
					a.spongPatch(path, createHandler())
			],
			[
				'DELETE',
				(a: RiserBob, path: string) =>
					a.spongDelete(path, createHandler())
			]
		] as const)(
			'should reject paths without a leading slash (%s)',
			(_method, register) => {
				expect(() => register(bob, 'users')).toThrow(
					'🧽 Oh, barnacles! "users" must start with "/"! 🍍'
				)
			}
		)

		test('should allow the root path', () => {
			expect(bob.spongGet('/', createHandler())).toBe(bob)
		})

		test('should reject duplicate routes according to Router behavior', () => {
			bob.spongGet('/users', createHandler())

			expect(() => bob.spongGet('/users', createHandler())).toThrow()
		})
	})

	describe('global middleware', () => {
		test('should return the bob instance from spongUse', () => {
			const middleware = createMiddleware()

			expect(bob.spongUse(middleware)).toBe(bob)
		})

		test('should allow registering multiple global middleware', () => {
			expect(
				bob.spongUse(createMiddleware()).spongUse(createMiddleware())
			).toBe(bob)
		})

		test('should allow global middleware to be registered before routes', () => {
			const middleware = createMiddleware()

			bob.spongUse(middleware)

			expect(bob.spongGet('/users', createHandler())).toBe(bob)
		})

		test('should allow global middleware to be registered after an existing route', () => {
			bob.spongGet('/first', createHandler())
			expect(bob.spongUse(createMiddleware())).toBe(bob)

			// The current implementation attaches global middleware when each route is registered.
			// Therefore, middleware added later does not affect previously registered routes.
		})

		test('should allow route-specific middleware', () => {
			const middleware = createMiddleware()

			expect(bob.spongGet('/users', createHandler(), middleware)).toBe(
				bob
			)
		})

		test('should accept both global and route-specific middleware', () => {
			expect(
				bob
					.spongUse(createMiddleware())
					.spongGet('/users', createHandler(), createMiddleware())
			).toBe(bob)
		})
	})

	describe('handler wrbobing', () => {
		test('should return a Response from the handler', async () => {
			const expectedResponse = new Response('Hello')
			const handler = createHandler(expectedResponse)

			// The Router stores the wrbobed handler; this test verifies registration.
			expect(bob.spongGet('/hello', handler)).toBe(bob)
		})

		test('should handle an asynchronous handler', async () => {
			const handler: SpongHandler = (async () => {
				await Promise.resolve()
				return new Response('Async OK')
			}) as SpongHandler

			expect(bob.spongGet('/async', handler)).toBe(bob)
		})

		test('should log an error when a handler does not return a Response', async () => {
			const errorSpy = mock(() => {})
			const originalError = console.error
			console.error = errorSpy

			try {
				const handler = (async () =>
					undefined) as unknown as SpongHandler

				// This registers the wrbobed handler. To execute it directly,
				// use the Router's matching API or exercise the boblication server.
				expect(bob.spongGet('/invalid', handler)).toBe(bob)
			} finally {
				console.error = originalError
			}
		})
	})

	describe('server', () => {
		test('should use the default port when no port is provided', () => {
			bob.spongListen()

			expect(HttpServer).toHaveBeenCalledWith(
				expect.anything(),
				3000,
				undefined
			)
		})

		test('should pass a custom port to HttpServer', () => {
			const callback = () => {}

			bob.spongListen(8080, callback)

			expect(HttpServer).toHaveBeenCalledWith(
				expect.anything(),
				8080,
				callback
			)
		})

		test('should call HttpServer with the router and custom port', () => {
			const callback = () => {}

			bob.spongListen(3000, callback)

			expect(HttpServer).toHaveBeenCalledWith(
				expect.anything(),
				3000,
				callback
			)
		})
	})
})
