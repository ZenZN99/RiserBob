import { ErrorMessages } from '../errors/errors-messages'
import type { SpongMiddleware, SpongNext } from '../types/spong-middleware'
import type { SpongResponse } from '../types/spong-response'

export class MiddlewarePipeline<Context = unknown> {
	private readonly middlewares: SpongMiddleware<Context>[] = []

	constructor(
		private readonly errorMessages: ErrorMessages = new ErrorMessages()
	) {}

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
				throw new Error(this.errorMessages.nextCalledMultipleTimes())
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
