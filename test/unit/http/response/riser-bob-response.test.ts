import { describe, expect, test } from 'bun:test'
import { RiserBobResponse } from '../../../../src/http/response/riser-bob-response'
import { StatusCode } from '../../../../src/http/response/status-code'

describe('RiserBobResponse', () => {
	describe('send()', () => {
		test('should return a Response with the default status 200', async () => {
			const response = RiserBobResponse().send('Hello RiserBob')

			expect(response).toBeInstanceOf(Response)
			expect(response.status).toBe(StatusCode.OK)
			expect(await response.text()).toBe('Hello RiserBob')
		})

		test('should use the configured status', () => {
			const response = RiserBobResponse()
				.status(StatusCode.Created)
				.send('Created')

			expect(response.status).toBe(StatusCode.Created)
		})

		test('should include configured headers', () => {
			const response = RiserBobResponse()
				.header('X-Powered-By', 'RiserBob')
				.send('Hello')

			expect(response.headers.get('X-Powered-By')).toBe('RiserBob')
		})
	})

	describe('json()', () => {
		test('should return JSON with status 200 by default', async () => {
			const data = { message: 'Hello', count: 2 }
			const response = RiserBobResponse().json(data)

			expect(response.status).toBe(StatusCode.OK)
			expect(response.headers.get('content-type')).toContain(
				'application/json'
			)
			expect(await response.json()).toEqual(data)
		})

		test('should use the configured status', async () => {
			const response = RiserBobResponse()
				.status(StatusCode.Created)
				.json({ id: 1 })

			expect(response.status).toBe(StatusCode.Created)
			expect(await response.json()).toEqual({ id: 1 })
		})

		test('should accept an explicit status', () => {
			const response = RiserBobResponse().json(
				{ error: 'Not Found' },
				StatusCode.NotFound
			)

			expect(response.status).toBe(StatusCode.NotFound)
		})

		test('should preserve configured headers', () => {
			const response = RiserBobResponse()
				.header('X-Request-Id', 'request-123')
				.json({ success: true })

			expect(response.headers.get('X-Request-Id')).toBe('request-123')
		})

		test.each([204, 205, 304])(
			'should reject JSON responses with status %i',
			(status) => {
				expect(() =>
					RiserBobResponse().json({ message: 'Hello' }, status)
				).toThrow(TypeError)
			}
		)

		test('should reject status codes below 200', () => {
			expect(() => RiserBobResponse().json({}, 199)).toThrow(RangeError)
		})

		test('should reject status codes above 599', () => {
			expect(() => RiserBobResponse().json({}, 600)).toThrow(RangeError)
		})
	})

	describe('status()', () => {
		test('should support chaining', () => {
			const responseBuilder = RiserBobResponse()

			expect(responseBuilder.status(StatusCode.Created)).toBe(
				responseBuilder
			)
		})

		test('should use the latest configured status', () => {
			const response = RiserBobResponse()
				.status(StatusCode.Accepted)
				.status(StatusCode.Created)
				.send('Created')

			expect(response.status).toBe(StatusCode.Created)
		})
	})

	describe('header()', () => {
		test('should support chaining', () => {
			const responseBuilder = RiserBobResponse()

			expect(responseBuilder.header('X-Test', 'value')).toBe(
				responseBuilder
			)
		})

		test('should allow multiple headers', () => {
			const response = RiserBobResponse()
				.header('X-One', '1')
				.header('X-Two', '2')
				.send('OK')

			expect(response.headers.get('X-One')).toBe('1')
			expect(response.headers.get('X-Two')).toBe('2')
		})

		test('should replace a header with the same name', () => {
			const response = RiserBobResponse()
				.header('X-Test', 'old')
				.header('X-Test', 'new')
				.send('OK')

			expect(response.headers.get('X-Test')).toBe('new')
		})
	})

	describe('empty responses', () => {
		test.each([
			['SpongNoContent', 204],
			['SpongResetContent', 205],
			['SpongNotModified', 304]
		] as const)(
			'%s should return status %i without a body',
			async (method, status) => {
				const builder = RiserBobResponse()
				const response = builder[method]()

				expect(response.status).toBe(status)
				expect(await response.text()).toBe('')
			}
		)

		test('should preserve headers on empty responses', () => {
			const response = RiserBobResponse()
				.header('X-Request-Id', 'abc')
				.SpongNoContent()

			expect(response.status).toBe(204)
			expect(response.headers.get('X-Request-Id')).toBe('abc')
		})
	})

	describe('status helpers', () => {
		test.each([
			['SpongOK', 200],
			['SpongCreated', 201],
			['SpongAccepted', 202],
			['SpongBadRequest', 400],
			['SpongUnauthorized', 401],
			['SpongForbidden', 403],
			['SpongNotFound', 404],
			['SpongConflict', 409],
			['SpongTooManyRequests', 429],
			['SpongInternalServerError', 500],
			['SpongNotImplemented', 501],
			['SpongBadGateway', 502],
			['SpongServiceUnavailable', 503],
			['SpongGatewayTimeout', 504]
		] as const)(
			'%s should return status %i with JSON',
			async (method, status) => {
				const response = RiserBobResponse()[method]()

				expect(response.status).toBe(status)
				expect(response.headers.get('content-type')).toContain(
					'application/json'
				)
				expect(await response.json()).toBeDefined()
			}
		)

		test('SpongOK should use its default payload', async () => {
			const response = RiserBobResponse().SpongOK()

			expect(await response.json()).toEqual({ message: 'OK' })
		})

		test('SpongNotFound should accept a custom payload', async () => {
			const response = RiserBobResponse().SpongNotFound({
				error: 'Product not found'
			})

			expect(response.status).toBe(404)
			expect(await response.json()).toEqual({
				error: 'Product not found'
			})
		})
	})

	describe('redirect()', () => {
		test('SpongFound should return status 302', () => {
			const response = RiserBobResponse().SpongFound('/products')

			expect(response.status).toBe(302)
			expect(response.headers.get('location')).toBe(
				'http://localhost/products'
			)
		})

		test('SpongMovedPermanently should return status 301', () => {
			const response = RiserBobResponse().SpongMovedPermanently('/')

			expect(response.status).toBe(301)
			expect(response.headers.get('location')).toBe('http://localhost/')
		})

		test('should preserve custom headers on redirects', () => {
			const response = RiserBobResponse()
				.header('X-Request-Id', 'redirect-123')
				.SpongFound('/login')

			expect(response.headers.get('X-Request-Id')).toBe('redirect-123')
			expect(response.headers.get('location')).toBe(
				'http://localhost/login'
			)
		})

		test('should resolve relative paths against the default base URL', () => {
			const response = RiserBobResponse().SpongSeeOther('login')

			expect(response.headers.get('location')).toBe(
				'http://localhost/login'
			)
		})
	})
})
