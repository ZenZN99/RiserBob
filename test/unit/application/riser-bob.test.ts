import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test
} from 'bun:test'
import type { SpongHandler } from '../../../src/types/spong-handler'
import type { SpongRequest } from '../../../src/types/spong-request'
import type { SpongMiddleware } from '../../../src/types/spong-middleware'
import { Router } from '../../../src/routing/router'
import { ErrorMessages } from '../../../src/errors/errors-messages'
import { HttpError } from '../../../src/errors/http-error'
import { SpongMethod } from '../../../src/types/spong-method'
import type { SocketIOIntegration } from '../../../src/types/socket-io-integration'

const mockServer = {
	stop: mock(() => {})
}

const httpServerMock = mock(
	(
		_router: Router,
		_errorMessages: ErrorMessages,
		_port: number,
		_callback?: () => void,
		_socketIO?: SocketIOIntegration
	) => mockServer
)

mock.module('../../../src/server/http-server', () => ({
	HttpServer: httpServerMock
}))

const { RiserBob } = await import('../../../src/application/riser-bob')
type RiserBob = InstanceType<typeof RiserBob>

type HandlerArgs = Parameters<SpongHandler>

const createHandler = (
	response: Response = new Response('OK')
): SpongHandler => {
	return (async () => response) as SpongHandler
}

const createMiddleware = (
	callback?: (req: SpongRequest) => void
): SpongMiddleware<SpongRequest> => {
	return (async (req, _res, next) => {
		callback?.(req)
		return next()
	}) as SpongMiddleware<SpongRequest>
}

const fakeArgs = (): HandlerArgs => [{}, {}] as unknown as HandlerArgs

describe('RiserBob', () => {
	let bob: RiserBob

	beforeEach(() => {
		httpServerMock.mockClear()
		bob = new RiserBob()
	})

	afterEach(() => {
		mock.restore()
	})

	// Registers a route and returns the handler that RiserBob stored in the Router.
	const captureWrappedHandler = (
		register: (app: RiserBob) => unknown
	): SpongHandler => {
		const registerSpy = spyOn(Router.prototype, 'register')

		try {
			register(bob)
			const call = registerSpy.mock.calls.at(-1)

			if (!call) throw new Error('Router.register was not called')

			return call[2] as SpongHandler
		} finally {
			registerSpy.mockRestore()
		}
	}

	describe('route registration', () => {
		test('should register a GET route and return the app instance', () => {
			expect(bob.spongGet('/users', createHandler())).toBe(bob)
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

		test('should register a HEAD route', () => {
			expect(bob.spongHead('/users', createHandler())).toBe(bob)
		})

		test('should register an OPTIONS route', () => {
			expect(bob.spongOptions('/users', createHandler())).toBe(bob)
		})

		test('should support method chaining', () => {
			expect(
				bob
					.spongGet('/users', createHandler())
					.spongPost('/users', createHandler())
					.spongPut('/users/:id', createHandler())
					.spongPatch('/users/:id', createHandler())
					.spongDelete('/users/:id', createHandler())
					.spongHead('/users/head', createHandler())
					.spongOptions('/users/options', createHandler())
			).toBe(bob)
		})

		test.each([
			[
				'GET',
				SpongMethod.GET,
				(a: RiserBob, path: string) => a.spongGet(path, createHandler())
			],
			[
				'POST',
				SpongMethod.POST,
				(a: RiserBob, path: string) =>
					a.spongPost(path, createHandler())
			],
			[
				'PUT',
				SpongMethod.PUT,
				(a: RiserBob, path: string) => a.spongPut(path, createHandler())
			],
			[
				'PATCH',
				SpongMethod.PATCH,
				(a: RiserBob, path: string) =>
					a.spongPatch(path, createHandler())
			],
			[
				'DELETE',
				SpongMethod.DELETE,
				(a: RiserBob, path: string) =>
					a.spongDelete(path, createHandler())
			],
			[
				'HEAD',
				SpongMethod.HEAD,
				(a: RiserBob, path: string) =>
					a.spongHead(path, createHandler())
			],
			[
				'OPTIONS',
				SpongMethod.OPTIONS,
				(a: RiserBob, path: string) =>
					a.spongOptions(path, createHandler())
			]
		] as const)(
			'should register the %s method on the router',
			(_label, method, register) => {
				const registerSpy = spyOn(Router.prototype, 'register')

				register(bob, '/users')

				expect(registerSpy).toHaveBeenCalledTimes(1)
				expect(registerSpy.mock.calls[0]?.[0]).toBe(method)
				expect(registerSpy.mock.calls[0]?.[1]).toBe('/users')
			}
		)

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
			],
			[
				'HEAD',
				(a: RiserBob, path: string) =>
					a.spongHead(path, createHandler())
			],
			[
				'OPTIONS',
				(a: RiserBob, path: string) =>
					a.spongOptions(path, createHandler())
			]
		] as const)(
			'should reject paths without a leading slash (%s)',
			(_method, register) => {
				expect(() => register(bob, 'users')).toThrow(
					new ErrorMessages(true).invalidPath('users')
				)
			}
		)

		test('should use the plain error message when funnyMode is disabled', () => {
			const serious = new RiserBob({ funnyMode: false })

			expect(() => serious.spongGet('users', createHandler())).toThrow(
				new ErrorMessages(false).invalidPath('users')
			)
		})

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
			expect(bob.spongUse(createMiddleware())).toBe(bob)
		})

		test('should allow registering multiple global middleware', () => {
			expect(
				bob.spongUse(createMiddleware()).spongUse(createMiddleware())
			).toBe(bob)
		})

		test('should allow global middleware to be registered before routes', () => {
			bob.spongUse(createMiddleware())

			expect(bob.spongGet('/users', createHandler())).toBe(bob)
		})

		test('should allow route-specific middleware', () => {
			expect(
				bob.spongGet('/users', createHandler(), createMiddleware())
			).toBe(bob)
		})

		test('should accept both global and route-specific middleware', () => {
			expect(
				bob
					.spongUse(createMiddleware())
					.spongGet('/users', createHandler(), createMiddleware())
			).toBe(bob)
		})
	})

	describe('handler wrapping', () => {
		test('should return the Response from the handler', async () => {
			const expected = new Response('Hello')

			const wrapped = captureWrappedHandler((a) =>
				a.spongGet('/hello', createHandler(expected))
			)

			expect(await wrapped(...fakeArgs())).toBe(expected)
		})

		test('should support an asynchronous handler', async () => {
			const handler: SpongHandler = (async () => {
				await Promise.resolve()
				return new Response('Async OK')
			}) as SpongHandler

			const wrapped = captureWrappedHandler((a) =>
				a.spongGet('/async', handler)
			)

			const response = await wrapped(...fakeArgs())

			expect(await (response as Response).text()).toBe('Async OK')
		})

		test('should run global middleware before route middleware and the handler', async () => {
			const order: string[] = []

			bob.spongUse(createMiddleware(() => order.push('global')))

			const handler = (async () => {
				order.push('handler')
				return new Response('OK')
			}) as SpongHandler

			const wrapped = captureWrappedHandler((a) =>
				a.spongGet(
					'/users',
					handler,
					createMiddleware(() => order.push('route'))
				)
			)

			await wrapped(...fakeArgs())

			expect(order).toEqual(['global', 'route', 'handler'])
		})

		test('should not apply global middleware added after a route was registered', async () => {
			const calls: string[] = []

			const wrapped = captureWrappedHandler((a) =>
				a.spongGet('/first', createHandler())
			)

			bob.spongUse(createMiddleware(() => calls.push('late')))

			await wrapped(...fakeArgs())

			expect(calls).toEqual([])
		})

		test('should apply global middleware registered before the route', async () => {
			const calls: string[] = []

			bob.spongUse(createMiddleware(() => calls.push('early')))

			const wrapped = captureWrappedHandler((a) =>
				a.spongGet('/first', createHandler())
			)

			await wrapped(...fakeArgs())

			expect(calls).toEqual(['early'])
		})

		test('should log and throw a 500 error when a handler does not return a Response', async () => {
			const errorSpy = spyOn(console, 'error').mockImplementation(
				() => {}
			)

			const handler = (async () => undefined) as unknown as SpongHandler

			const wrapped = captureWrappedHandler((a) =>
				a.spongGet('/invalid', handler)
			)

			let thrown: unknown

			try {
				await wrapped(...fakeArgs())
			} catch (error) {
				thrown = error
			}

			expect(thrown).toBeInstanceOf(HttpError)
			expect((thrown as Error).message).toBe(
				'Handler did not send a response'
			)
			expect(errorSpy).toHaveBeenCalledTimes(1)
		})
	})

	describe('server', () => {
		test('should use the default port when no port is provided', () => {
			bob.spongListen()

			expect(httpServerMock).toHaveBeenCalledWith(
				expect.any(Router),
				expect.any(ErrorMessages),
				4000,
				undefined,
				undefined
			)
		})

		test('should pass a custom port and callback to HttpServer', () => {
			const callback = () => {}

			bob.spongListen(8080, callback)

			expect(httpServerMock).toHaveBeenCalledWith(
				expect.any(Router),
				expect.any(ErrorMessages),
				8080,
				callback,
				undefined
			)
		})

		test('should return the value produced by HttpServer', () => {
			const server = bob.spongListen(4000)

			expect(httpServerMock.mock.results[0]?.value).toBe(server)
		})
	})

	describe('socket.io', () => {
		test('should create a Socket.IO server with the default path', () => {
			const io = bob.spongSocketIO()

			expect(io).toBeDefined()

			bob.spongListen()

			expect(httpServerMock).toHaveBeenCalledWith(
				expect.any(Router),
				expect.any(ErrorMessages),
				4000,
				undefined,
				expect.objectContaining({ io, path: '/socket.io/' })
			)
		})

		test('should use a custom path', () => {
			const io = bob.spongSocketIO({ path: '/realtime/' })

			bob.spongListen()

			expect(httpServerMock).toHaveBeenCalledWith(
				expect.any(Router),
				expect.any(ErrorMessages),
				4000,
				undefined,
				expect.objectContaining({ io, path: '/realtime/' })
			)
		})

		test('should return the same instance when called twice', () => {
			const first = bob.spongSocketIO()
			const second = bob.spongSocketIO({ path: '/ignored/' })

			expect(second).toBe(first)
		})

		test('should not pass Socket.IO to HttpServer when it was never enabled', () => {
			bob.spongListen()

			expect(httpServerMock.mock.calls[0]?.[4]).toBeUndefined()
		})
	})
})
