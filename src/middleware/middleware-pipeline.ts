import type { SpongMiddleware } from '../types/spong-middleware'
import type { SpongResponse } from '../types/spong-response'

export type SpongNext = () => Promise<Response>



export class MiddlewarePipeline<Context = unknown> {
	private readonly middlewares: SpongMiddleware<Context>[] = []

	use(middleware: SpongMiddleware<Context>): this {
		this.middlewares.push(middleware)
		return this
	}

	async execute(
		context: Context,
		spongRes: SpongResponse,
		finalHandler: SpongNext
	): Promise<Response> {
		let index = -1

		const dispatch = async (currentIndex: number): Promise<Response> => {
			if (currentIndex <= index) {
				throw new Error(
					'[RiserBob] 🧽 Oh, barnacles! next() called multiple times!'
				)
			}

			index = currentIndex

			const middleware = this.middlewares[currentIndex]

			if (!middleware) {
				return finalHandler()
			}

			return middleware(context, spongRes, () =>
				dispatch(currentIndex + 1)
			)
		}

		return dispatch(0)
	}
}
