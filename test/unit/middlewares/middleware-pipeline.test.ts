import { describe, expect, it, mock } from 'bun:test'
import { MiddlewarePipeline } from '../../../src/middleware/middleware-pipeline'
import type { SpongMiddleware } from '../../../src/types/spong-middleware'
import type { SpongResponse } from '../../../src/types/spong-response'

describe('MiddlewarePipeline', () => {
	const createResponse = (): SpongResponse => ({}) as SpongResponse

	it('should execute the final handler when no middleware exists', async () => {
		const pipeline = new MiddlewarePipeline<{ id: string }>()
		const context = { id: 'user-1' }

		const finalHandler = mock(async () =>
			Response.json({ message: 'Final handler' })
		)

		const response = await pipeline.execute(
			context,
			createResponse(),
			finalHandler
		)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({
			message: 'Final handler'
		})
		expect(finalHandler).toHaveBeenCalledTimes(1)
	})

	it('should execute middleware in registration order', async () => {
		const pipeline = new MiddlewarePipeline<object>()
		const responseContext = createResponse()
		const order: string[] = []

		pipeline.use(async (_context, _res, next) => {
			order.push('first-before')
			const response = await next()
			order.push('first-after')
			return response
		})

		pipeline.use(async (_context, _res, next) => {
			order.push('second-before')
			const response = await next()
			order.push('second-after')
			return response
		})

		const response = await pipeline.execute(
			{},
			responseContext,
			async () => {
				order.push('handler')
				return Response.json({ success: true })
			}
		)

		expect(response.status).toBe(200)
		expect(order).toEqual([
			'first-before',
			'second-before',
			'handler',
			'second-after',
			'first-after'
		])
	})

	it('should pass the same context and response to every middleware', async () => {
		type Context = { userId: string }

		const pipeline = new MiddlewarePipeline<Context>()
		const context = { userId: '42' }
		const spongRes = createResponse()

		const first = mock(
			async (
				_context: Context,
				_res: SpongResponse,
				next: () => Promise<Response>
			) => next()
		)

		const second = mock(
			async (
				_context: Context,
				_res: SpongResponse,
				next: () => Promise<Response>
			) => next()
		)

		pipeline.use(first)
		pipeline.use(second)

		await pipeline.execute(context, spongRes, async () => Response.json({}))

		expect(first).toHaveBeenCalledWith(
			context,
			spongRes,
			expect.any(Function)
		)

		expect(second).toHaveBeenCalledWith(
			context,
			spongRes,
			expect.any(Function)
		)
	})

	it('should allow middleware to return a response without calling next', async () => {
		const pipeline = new MiddlewarePipeline<object>()
		const finalHandler = mock(async () => Response.json({ success: true }))

		pipeline.use(async () =>
			Response.json({ error: 'Unauthorized' }, { status: 401 })
		)

		const response = await pipeline.execute(
			{},
			createResponse(),
			finalHandler
		)

		expect(response.status).toBe(401)
		expect(await response.json()).toEqual({
			error: 'Unauthorized'
		})
		expect(finalHandler).not.toHaveBeenCalled()
	})

	it('should support synchronous middleware', async () => {
		const pipeline = new MiddlewarePipeline<object>()

		const middleware: SpongMiddleware<object> = (_context, _res, next) =>
			next()

		pipeline.use(middleware)

		const response = await pipeline.execute(
			{},
			createResponse(),
			async () => Response.json({ message: 'OK' })
		)

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ message: 'OK' })
	})

	it('should propagate errors thrown by middleware', async () => {
		const pipeline = new MiddlewarePipeline<object>()

		pipeline.use(async () => {
			throw new Error('Middleware failed')
		})

		await expect(
			pipeline.execute({}, createResponse(), async () =>
				Response.json({})
			)
		).rejects.toThrow('Middleware failed')
	})

	it('should propagate errors thrown by the final handler', async () => {
		const pipeline = new MiddlewarePipeline<object>()

		await expect(
			pipeline.execute({}, createResponse(), async () => {
				throw new Error('Handler failed')
			})
		).rejects.toThrow('Handler failed')
	})

	it('should reject calling next more than once', async () => {
		const pipeline = new MiddlewarePipeline<object>()

		pipeline.use(async (_context, _res, next) => {
			await next()
			return next()
		})

		await expect(
			pipeline.execute({}, createResponse(), async () =>
				Response.json({ success: true })
			)
		).rejects.toThrow(
			'[RiserBob] 🧽 Oh, barnacles! next() called multiple times!'
		)
	})

	it('should reject calling next concurrently more than once', async () => {
		const pipeline = new MiddlewarePipeline<object>()

		pipeline.use(async (_context, _res, next) => {
			const results = await Promise.allSettled([next(), next()])

			const rejected = results.filter(
				(result) => result.status === 'rejected'
			)

			expect(rejected).toHaveLength(1)

			return Response.json({ success: true })
		})

		await pipeline.execute({}, createResponse(), async () =>
			Response.json({ success: true })
		)
	})
})
