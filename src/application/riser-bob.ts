import { SpongMethod, type HttpMethod } from '../types/spong-method'
import type { SpongHandler } from '../types/spong-handler'
import { Router } from '../routing/router'
import type { SpongRequest } from '../types/spong-request'
import type { SpongMiddleware } from '../types/spong-middleware'
import { MiddlewarePipeline } from '../middleware/middleware-pipeline'
import { HttpServer } from '../server/http-server'
import { HttpError } from '../errors/http-error'

export class RiserBob {
	private readonly router = new Router()
	private readonly middlewares: SpongMiddleware<SpongRequest>[] = []

	private register(
		method: HttpMethod,
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		if (!path.startsWith('/')) {
			throw new Error(
				`🧽 Oh, barnacles! "${path}" must start with "/"! 🍍`
			)
		}

		const pipeline = new MiddlewarePipeline<SpongRequest>()

		for (const middleware of this.middlewares) {
			pipeline.use(middleware)
		}

		for (const middleware of middlewares) {
			pipeline.use(middleware)
		}

		const wrappedHandler: SpongHandler = async (spongReq, spongRes) => {
			return pipeline.execute(
				spongReq,
				spongRes,
				async (): Promise<Response> => {
					const result = await handler(spongReq, spongRes)

					if (result instanceof Response) {
						return result
					}

					console.error(
						'[RiserBob] 🧽 Oh, barnacles! Handler did not return a Response! 🍍'
					)

					throw new HttpError(500, 'Handler did not send a response')
				}
			)
		}

		this.router.register(method, path, wrappedHandler)

		return this
	}

	spongGet(
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		return this.register(SpongMethod.GET, path, handler, ...middlewares)
	}

	spongPost(
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		return this.register(SpongMethod.POST, path, handler, ...middlewares)
	}

	spongPut(
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		return this.register(SpongMethod.PUT, path, handler, ...middlewares)
	}

	spongPatch(
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		return this.register(SpongMethod.PATCH, path, handler, ...middlewares)
	}

	spongDelete(
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		return this.register(SpongMethod.DELETE, path, handler, ...middlewares)
	}

	spongHead(
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		return this.register(SpongMethod.HEAD, path, handler, ...middlewares)
	}

	spongOptions(
		path: string,
		handler: SpongHandler,
		...middlewares: SpongMiddleware<SpongRequest>[]
	): this {
		return this.register(SpongMethod.OPTIONS, path, handler, ...middlewares)
	}

	spongUse(middleware: SpongMiddleware<SpongRequest>): this {
		this.middlewares.push(middleware)
		return this
	}

	spongListen(port = 4000, callback?: () => void) {
		return HttpServer(this.router, port, callback)
	}
}
