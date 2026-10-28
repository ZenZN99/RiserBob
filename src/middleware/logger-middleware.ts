import type { ErrorMessages } from '../errors/errors-messages'
import type { SpongNext } from '../types/spong-middleware'
import type { SpongRequest } from '../types/spong-request'
import type { SpongResponse } from '../types/spong-response'

const defaultErrorMessages = {
	requestFailed: () => '[RiserBob] 💀🧽 Barnacles! Request failed!'
}

export const createLoggerMiddleware = (errorMessages: ErrorMessages) => {
	return async (
		spongReq: SpongRequest,
		spongRes: SpongResponse,
		spongNext: SpongNext
	): Promise<Response> => {
		const startTime = performance.now()
		let statusCode = 500

		try {
			const response = await spongNext()
			statusCode = response.status
			return response
		} catch (error) {
			console.error(errorMessages.requestFailed(), error)
			throw error
		} finally {
			const duration = (performance.now() - startTime).toFixed(2)
			const timestamp = new Date().toISOString()

			console.log(
				`[RiserBob] ${timestamp} | ${spongReq.method} ${spongReq.path} | ${statusCode} | ${duration}ms`
			)
		}
	}
}

export const loggerMiddleware = createLoggerMiddleware(
	defaultErrorMessages as ErrorMessages
)
