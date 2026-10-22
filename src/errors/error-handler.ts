import { HttpError } from './http-error'

export class ErrorHandler {
	static handle(error: unknown): Response {
		if (error instanceof HttpError) {
			return Response.json(
				{ error: error.message },
				{ status: error.status }
			)
		}

		console.error('[RiserBob] 🧽 An unexpected error occurred!', error)

		return Response.json(
			{ error: 'Internal Server Error' },
			{ status: 500 }
		)
	}
}
