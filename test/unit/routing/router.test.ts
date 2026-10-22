import { describe, expect, test } from 'bun:test'
import type { SpongHandler } from '../../../src/types/spong-handler'
import { Router } from '../../../src/routing/router'
import { SpongMethod } from '../../../src/types/spong-method'

const createHandler = (): SpongHandler =>
	(() => new Response('OK')) as SpongHandler

describe('Router', () => {
	describe('register()', () => {
		test('should register a route and return the router instance', () => {
			const router = new Router()
			const handler = createHandler()

			expect(router.register(SpongMethod.GET, '/users', handler)).toBe(
				router
			)

			expect(router.match('GET', '/users')).toEqual({
				handler,
				params: {}
			})
		})

		test('should register routes with different HTTP methods', () => {
			const router = new Router()
			const getHandler = createHandler()
			const postHandler = createHandler()

			router.register(SpongMethod.GET, '/users', getHandler)
			router.register(SpongMethod.POST, '/users', postHandler)

			expect(router.match('GET', '/users')?.handler).toBe(getHandler)
			expect(router.match('POST', '/users')?.handler).toBe(postHandler)
		})

		test('should throw when registering a duplicate route', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/users', createHandler())

			expect(() =>
				router.register(SpongMethod.GET, '/users', createHandler())
			).toThrow('Route "GET /users" already lives in Bikini Bottom!')
		})

		test('should allow the same path with different methods', () => {
			const router = new Router()

			expect(() => {
				router.register(SpongMethod.GET, '/users', createHandler())
				router.register(SpongMethod.DELETE, '/users', createHandler())
			}).not.toThrow()
		})
	})

	describe('match()', () => {
		test('should match a static route', () => {
			const router = new Router()
			const handler = createHandler()

			router.register(SpongMethod.GET, '/products', handler)

			expect(router.match('GET', '/products')).toEqual({
				handler,
				params: {}
			})
		})

		test('should return undefined when the route does not exist', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/products', createHandler())

			expect(router.match('GET', '/users')).toBeUndefined()
		})

		test('should return undefined for an unsupported method', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/products', createHandler())

			expect(router.match('DELETE', '/products')).toBeUndefined()
		})

		test('should match a route with one dynamic parameter', () => {
			const router = new Router()
			const handler = createHandler()

			router.register(SpongMethod.GET, '/users/:id', handler)

			expect(router.match('GET', '/users/42')).toEqual({
				handler,
				params: { id: '42' }
			})
		})

		test('should match multiple dynamic parameters', () => {
			const router = new Router()
			const handler = createHandler()

			router.register(
				SpongMethod.GET,
				'/users/:userId/posts/:postId',
				handler
			)

			expect(router.match('GET', '/users/10/posts/25')).toEqual({
				handler,
				params: {
					userId: '10',
					postId: '25'
				}
			})
		})

		test('should not match when the number of path segments differs', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/users/:id', createHandler())

			expect(router.match('GET', '/users')).toBeUndefined()
			expect(router.match('GET', '/users/42/posts')).toBeUndefined()
		})

		test('should not treat static segments as dynamic parameters', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/users/profile', createHandler())

			expect(router.match('GET', '/users/123')).toBeUndefined()
		})

		test('should decode URL-encoded parameters', () => {
			const router = new Router()
			const handler = createHandler()

			router.register(SpongMethod.GET, '/users/:name', handler)

			expect(
				router.match('GET', '/users/Zen%20Allah am'.replace(' ', '%20'))
			).toEqual({
				handler,
				params: { name: 'Zen Allah am' }
			})
		})

		test('should return undefined for malformed URL encoding', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/users/:id', createHandler())

			expect(router.match('GET', '/users/%E0%A4%A')).toBeUndefined()
		})

		test('should prefer a static route over a dynamic route', () => {
			const router = new Router()
			const dynamicHandler = createHandler()
			const staticHandler = createHandler()

			router.register(SpongMethod.GET, '/users/:id', dynamicHandler)
			router.register(SpongMethod.GET, '/users/me', staticHandler)

			expect(router.match('GET', '/users/me')).toEqual({
				handler: staticHandler,
				params: {}
			})
		})

		test('should match the dynamic route when no static route matches', () => {
			const router = new Router()
			const dynamicHandler = createHandler()
			const staticHandler = createHandler()

			router.register(SpongMethod.GET, '/users/:id', dynamicHandler)
			router.register(SpongMethod.GET, '/users/me', staticHandler)

			expect(router.match('GET', '/users/123')).toEqual({
				handler: dynamicHandler,
				params: { id: '123' }
			})
		})

		test('should match the root route', () => {
			const router = new Router()
			const handler = createHandler()

			router.register(SpongMethod.GET, '/', handler)

			expect(router.match('GET', '/')).toEqual({
				handler,
				params: {}
			})
		})

		test('should treat trailing slashes as equivalent', () => {
			const router = new Router()
			const handler = createHandler()

			router.register(SpongMethod.GET, '/users/', handler)

			expect(router.match('GET', '/users')).toEqual({
				handler,
				params: {}
			})
		})

		test('should match only the exact HTTP method casing', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/users', createHandler())

			expect(router.match('get', '/users')).toBeUndefined()
		})
	})

	describe('allowedMethods()', () => {
		test('should return the methods registered for a path', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/users', createHandler())
			router.register(SpongMethod.POST, '/users', createHandler())
			router.register(SpongMethod.DELETE, '/users', createHandler())

			expect(router.allowedMethods('/users')).toEqual([
				SpongMethod.GET,
				SpongMethod.POST,
				SpongMethod.DELETE
			])
		})

		test('should return an empty array when no methods are registered', () => {
			const router = new Router()

			expect(router.allowedMethods('/missing')).toEqual([])
		})

		test('should return only methods registered for the exact path', () => {
			const router = new Router()

			router.register(SpongMethod.GET, '/users', createHandler())
			router.register(SpongMethod.POST, '/users/:id', createHandler())

			expect(router.allowedMethods('/users')).toEqual([SpongMethod.GET])
		})

		test('should return methods in the configured order', () => {
			const router = new Router()

			router.register(SpongMethod.DELETE, '/products', createHandler())
			router.register(SpongMethod.PATCH, '/products', createHandler())
			router.register(SpongMethod.GET, '/products', createHandler())
			router.register(SpongMethod.PUT, '/products', createHandler())
			router.register(SpongMethod.POST, '/products', createHandler())

			expect(router.allowedMethods('/products')).toEqual([
				SpongMethod.GET,
				SpongMethod.POST,
				SpongMethod.PUT,
				SpongMethod.PATCH,
				SpongMethod.DELETE
			])
		})
	})
})
