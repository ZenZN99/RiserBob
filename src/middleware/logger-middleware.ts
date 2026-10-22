import type { SpongRequest } from '../types/spong-request'
import type { SpongResponse } from '../types/spong-response'

type SpongNext = () => Promise<Response>

export const loggerMiddleware = async (
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
		console.error('[RiserBob] 💀🧽 Barnacles! Request failed!', error)

		throw error
	} finally {
		const duration = (performance.now() - startTime).toFixed(2)
		const timestamp = new Date().toISOString()

		console.log(
			`[RiserBob] ${timestamp} | ${spongReq.method} ${spongReq.path} | ${statusCode} | ${duration}ms`
		)
	}
}
