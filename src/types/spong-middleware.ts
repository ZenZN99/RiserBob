import type { SpongResponse } from "./spong-response"

export type SpongNext = () => Promise<Response>

export type SpongMiddleware<Context = unknown> = (
	context: Context,
	spongRes: SpongResponse,
	spongNext: SpongNext
) => Response | Promise<Response>