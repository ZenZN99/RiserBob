import type { SpongRequest } from './spong-request'
import type { SpongResponse } from './spong-response'

export type SpongHandler = (
	spongReq: SpongRequest,
	spongRes: SpongResponse
) => Response | void | Promise<Response | void>

export type RouteHandler = SpongHandler
