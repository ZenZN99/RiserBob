import { ErrorMessages } from '../errors/errors-messages'
import type { SpongMiddleware, SpongNext } from '../types/spong-middleware'
import type { SpongResponse } from '../types/spong-response'

export class MiddlewarePipeline<Context = unknown> {
  private readonly middlewares: SpongMiddleware<Context>[] = []

  constructor(private readonly errorMessages: ErrorMessages = new ErrorMessages()) {}

  use(middleware: SpongMiddleware<Context>): this {
    this.middlewares.push(middleware)
    return this
  }

  async execute(
    context: Context,
    spongRes: SpongResponse,
    finalHandler: SpongNext,
  ): Promise<Response> {
    const middlewares = this.middlewares
    const length = middlewares.length

    // Fast path: no middleware registered.
    if (length === 0) {
      return finalHandler()
    }

    let index = -1

    const dispatch = async (currentIndex: number): Promise<Response> => {
      if (currentIndex <= index) {
        throw new Error(this.errorMessages.nextCalledMultipleTimes())
      }

      index = currentIndex

      if (currentIndex >= length) {
        return finalHandler()
      }

      const middleware = middlewares[currentIndex]!

      return middleware(context, spongRes, () => dispatch(currentIndex + 1))
    }

    return dispatch(0)
  }
}
