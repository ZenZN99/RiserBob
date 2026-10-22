import { describe, expect, test, mock, afterEach } from 'bun:test'
import type { SpongRequest } from '../../../src/types/spong-request'
import type { SpongResponse } from '../../../src/types/spong-response'
import { loggerMiddleware } from '../../../src/middleware/logger-middleware'

describe('loggerMiddleware', () => {
	const originalLog = console.log
	const originalError = console.error

	afterEach(() => {
		console.log = originalLog
		console.error = originalError
	})

	const createRequest = (): SpongRequest =>
		({
			method: 'GET',
			path: '/users'
		}) as SpongRequest

	const createResponse = (): SpongResponse => ({}) as SpongResponse

	test('should return the response from next()', async () => {
		const response = Response.json({ users: [] })
		const next = mock(async () => response)

		const result = await loggerMiddleware(
			createRequest(),
			createResponse(),
			next
		)

		expect(result).toBe(response)
		expect(next).toHaveBeenCalledTimes(1)
	})

	test('should log request method, path, status and duration', async () => {
		const logs: string[] = []

		console.log = mock((message: string) => {
			logs.push(message)
		})

		await loggerMiddleware(
			createRequest(),
			createResponse(),
			async () => new Response('OK', { status: 200 })
		)

		expect(logs).toHaveLength(1)
		expect(logs[0]).toContain('GET /users')
		expect(logs[0]).toContain('| 200 |')
		expect(logs[0]).toMatch(/\d+\.\d{2}ms/)
	})

	test('should log the timestamp in ISO format', async () => {
		const logs: string[] = []

		console.log = mock((message: string) => {
			logs.push(message)
		})

		await loggerMiddleware(
			createRequest(),
			createResponse(),
			async () => new Response('OK')
		)

		expect(logs).toHaveLength(1)
		expect(logs[0]).toMatch(
			/^\[RiserBob\] \d{4}-\d{2}-\d{2}T.*Z \| GET \/users \| 200 \| \d+\.\d{2}ms$/
		)
	})

	test('should log errors and rethrow them', async () => {
		const errorLogs: unknown[][] = []
		const requestLogs: string[] = []
		const error = new Error('Database connection failed')

		console.error = mock((...args: unknown[]) => {
			errorLogs.push(args)
		})

		console.log = mock((message: string) => {
			requestLogs.push(message)
		})

		await expect(
			loggerMiddleware(createRequest(), createResponse(), async () => {
				throw error
			})
		).rejects.toBe(error)

		expect(errorLogs).toHaveLength(1)

		const loggedError = errorLogs[0]

		expect(loggedError).toBeDefined()

		if (!loggedError) {
			throw new Error('Expected an error log entry')
		}

		expect(loggedError[0]).toBe(
			'[RiserBob] 💀🧽 Barnacles! Request failed!'
		)
		expect(loggedError[1]).toBe(error)

		expect(requestLogs).toHaveLength(1)
		expect(requestLogs[0]).toContain('GET /users')
		expect(requestLogs[0]).toContain('| 500 |')
	})

	test('should log even if next() throws', async () => {
		const logs: string[] = []

		console.log = mock((message: string) => {
			logs.push(message)
		})

		await expect(
			loggerMiddleware(createRequest(), createResponse(), async () => {
				throw new Error('Request failed')
			})
		).rejects.toThrow('Request failed')

		expect(logs).toHaveLength(1)
		expect(logs[0]).toContain('GET /users')
		expect(logs[0]).toContain('| 500 |')
	})
})
