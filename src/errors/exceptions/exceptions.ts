import {
	normalizeInput,
	SpongHttpException,
	type SpongErrorInput,
	type SpongExceptionOptions
} from './spong-http-exception'

type SpongExceptionClass = new (
	input?: SpongErrorInput,
	options?: SpongExceptionOptions
) => SpongHttpException

const define = (
	status: number,
	code: string,
	defaultMessage: string
): SpongExceptionClass =>
	class extends SpongHttpException {
		constructor(
			input: SpongErrorInput = defaultMessage,
			options?: SpongExceptionOptions
		) {
			super(status, code, normalizeInput(input, defaultMessage), options)
		}
	}

export class SpongBadRequestException extends define(
	400,
	'BAD_REQUEST',
	'Bad Request'
) {}
export class SpongUnauthorizedException extends define(
	401,
	'UNAUTHORIZED',
	'Unauthorized'
) {}
export class SpongForbiddenException extends define(
	403,
	'FORBIDDEN',
	'Forbidden'
) {}
export class SpongNotFoundException extends define(
	404,
	'NOT_FOUND',
	'Not Found'
) {}
export class SpongMethodNotAllowedException extends define(
	405,
	'METHOD_NOT_ALLOWED',
	'Method Not Allowed'
) {}
export class SpongConflictException extends define(
	409,
	'CONFLICT',
	'Conflict'
) {}
export class SpongUnprocessableEntityException extends define(
	422,
	'UNPROCESSABLE_ENTITY',
	'Unprocessable Entity'
) {}
export class SpongTooManyRequestsException extends define(
	429,
	'TOO_MANY_REQUESTS',
	'Too Many Requests'
) {}
export class SpongInternalServerErrorException extends define(
	500,
	'INTERNAL_SERVER_ERROR',
	'Internal Server Error'
) {}
export class SpongServiceUnavailableException extends define(
	503,
	'SERVICE_UNAVAILABLE',
	'Service Unavailable'
) {}
