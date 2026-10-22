import { describe, expect, it, mock, spyOn } from 'bun:test'
import type { SpongRequest } from '../../../src/types/spong-request'
import type { SpongMiddleware } from '../../../src/types/spong-middleware'
import { AuthMiddleware } from '../../../src/middleware/auth-middleware'

function createRequest(authorization?: string): SpongRequest {
	const headers = new Headers()

	if (authorization !== undefined) {
		headers.set('authorization', authorization)
	}

	const request = new Request('http://localhost/', { headers })

	return {
		request,
		headers: request.headers
	} as SpongRequest
}

function createResponse() {
	return {
		SpongUnauthorized: mock((payload: unknown) =>
			Response.json(payload, { status: 401 })
		)
	} as unknown as Parameters<SpongMiddleware<SpongRequest>>[1]
}

function createNext() {
	return mock(async () =>
		Response.json({ message: 'Next middleware called' })
	)
}

async function readBody(response: Response) {
	return response.json()
}

describe('AuthMiddleware', () => {
	it('should return 401 when Authorization header is missing', async () => {
		const verifyToken = mock(() => ({ id: '1' }))
		const auth = new AuthMiddleware(verifyToken)
		const request = createRequest()
		const response = createResponse()
		const next = createNext()

		const result = await auth.middleware(request, response, next)

		expect(result.status).toBe(401)
		expect(await readBody(result)).toEqual({
			success: false,
			message: 'Authentication token is missing or invalid.'
		})
		expect(verifyToken).not.toHaveBeenCalled()
		expect(next).not.toHaveBeenCalled()
	})

	it('should return 401 when Authorization scheme is not Bearer', async () => {
		const verifyToken = mock(() => ({ id: '1' }))
		const auth = new AuthMiddleware(verifyToken)
		const request = createRequest('Basic abc123')
		const response = createResponse()
		const next = createNext()

		const result = await auth.middleware(request, response, next)

		expect(result.status).toBe(401)
		expect(verifyToken).not.toHaveBeenCalled()
		expect(next).not.toHaveBeenCalled()
	})

	it('should return 401 when the Bearer token is empty', async () => {
		const verifyToken = mock(() => ({ id: '1' }))
		const auth = new AuthMiddleware(verifyToken)
		const request = createRequest('Bearer    ')
		const response = createResponse()
		const next = createNext()

		const result = await auth.middleware(request, response, next)

		expect(result.status).toBe(401)
		expect(verifyToken).not.toHaveBeenCalled()
		expect(next).not.toHaveBeenCalled()
	})

	it('should return 401 when the token is invalid', async () => {
		const verifyToken = mock(() => null)
		const auth = new AuthMiddleware(verifyToken)
		const request = createRequest('Bearer invalid-token')
		const response = createResponse()
		const next = createNext()

		const result = await auth.middleware(request, response, next)

		expect(result.status).toBe(401)
		expect(await readBody(result)).toEqual({
			success: false,
			message: 'Token is invalid or expired.'
		})
		expect(verifyToken).toHaveBeenCalledWith('invalid-token')
		expect(next).not.toHaveBeenCalled()
	})

	it('should return 500 when token verification throws', async () => {
		const verifyToken = mock(() => {
			throw new Error('Verification failed')
		})

		const auth = new AuthMiddleware(verifyToken)
		const request = createRequest('Bearer valid-looking-token')
		const response = createResponse()
		const next = createNext()
		const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})

		try {
			const result = await auth.middleware(request, response, next)

			expect(result.status).toBe(500)
			expect(await readBody(result)).toEqual({
				error: 'Internal Server Error'
			})
			expect(next).not.toHaveBeenCalled()
		} finally {
			consoleSpy.mockRestore()
		}
	})

	it('should authenticate the user and call next', async () => {
		const user = {
			id: 'user-1',
			email: 'user@example.com'
		}

		const verifyToken = mock(async () => user)
		const auth = new AuthMiddleware(verifyToken)
		const request = createRequest('Bearer valid-token')
		const response = createResponse()
		const next = createNext()

		const result = await auth.middleware(request, response, next)

		expect(result.status).toBe(200)
		expect(await readBody(result)).toEqual({
			message: 'Next middleware called'
		})
		expect(verifyToken).toHaveBeenCalledWith('valid-token')
		expect(next).toHaveBeenCalledTimes(1)
		expect(request.user).toEqual(user)
		expect(request.auth).toEqual({
			token: 'valid-token'
		})
	})

	it('should support a synchronous token verifier', async () => {
		const user = { id: 'user-2' }
		const verifyToken = mock(() => user)
		const auth = new AuthMiddleware(verifyToken)
		const request = createRequest('Bearer sync-token')
		const response = createResponse()
		const next = createNext()

		const result = await auth.middleware(request, response, next)

		expect(result.status).toBe(200)
		expect(request.user).toEqual(user)
		expect(next).toHaveBeenCalledTimes(1)
	})
})
