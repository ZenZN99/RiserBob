import { ErrorHandler } from '../errors/error-handler'
import { HttpError } from '../errors/http-error'
import { requireJsonContentType } from '../http/content-negotiation'
import {
	DEFAULT_MAX_BODY_SIZE,
	readRequestBody
} from '../http/read-request-body'
import { RiserBobResponse } from '../http/response/riser-bob-response'
import type { Router } from '../routing/router'
import { SpongMethod } from '../types/spong-method'
import type { SpongRequest } from '../types/spong-request'
import Bun from 'bun'



export const HttpServer = (
	router: Router,
	port: number = 3000,
	callback?: () => void
) => {
	const server = Bun.serve({
		port,

		async fetch(request): Promise<Response> {
			try {
				const url = new URL(request.url)
				const origin = request.headers.get('origin')

				if (request.method === SpongMethod.OPTIONS) {
					const headers = new Headers()

					if (origin) {
						headers.set('Access-Control-Allow-Origin', origin)
						headers.set('Access-Control-Allow-Credentials', 'true')
						headers.set(
							'Access-Control-Allow-Methods',
							'GET, POST, PUT, PATCH, DELETE, OPTIONS'
						)
						headers.set(
							'Access-Control-Allow-Headers',
							'Content-Type, Authorization'
						)
						headers.set('Access-Control-Max-Age', '86400')
						headers.set('Vary', 'Origin')
					}

					return new Response(null, {
						status: 204,
						headers
					})
				}

				const matchedRoute = router.match(request.method, url.pathname)

				if (!matchedRoute) {
					const allowed = router.allowedMethods(url.pathname)

					if (allowed.length > 0) {
						console.error(
							`[RiserBob] 😭🧽 Method Not Allowed!\n` +
								`Requested Method: ${request.method}\n` +
								`Path: ${url.pathname}\n` +
								`Allowed Methods: ${allowed.join(', ')}`
						)

						return Response.json(
							{ error: 'Method Not Allowed' },
							{
								status: 405,
								headers: {
									Allow: allowed.join(', ')
								}
							}
						)
					}

					console.warn(
						`[RiserBob] 🧽😂 Welcome to Bikini Bottom!
  🔎 Requested Method: ${request.method}
  🛣️ Requested Path: ${url.pathname}
  🤷 Route not found! Did Patrick register it?
  🍍 SpongeBob: "I checked my pineapple, but the endpoint isn't there!"
  🦀 Mr. Krabs: "NO ROUTE, NO MONEY!"
  `
					)

					throw new HttpError(404, 'Not Found')
				}

				const { handler, params } = matchedRoute

				const contentLength = request.headers.get('content-length')

				if (
					contentLength !== null &&
					Number(contentLength) > DEFAULT_MAX_BODY_SIZE
				) {
					throw new HttpError(413, 'Content Too Large')
				}

				const spongReq: SpongRequest = {
					request,
					method: request.method,
					url,
					path: url.pathname,
					params,
					query: url.searchParams,
					headers: request.headers,
					formData: async () => {
						const body = await readRequestBody(request)

						const contentType = request.headers.get('content-type')

						if (!contentType) {
							throw new HttpError(400, 'Missing Content-Type')
						}

						const response = new Response(
							body.buffer.slice(
								body.byteOffset,
								body.byteOffset + body.byteLength
							) as ArrayBuffer,
							{
								headers: { 'Content-Type': contentType }
							}
						)

						try {
							return await response.formData()
						} catch {
							throw new HttpError(400, 'Invalid form data')
						}
					},
					json: async <T = unknown>(): Promise<T> => {
						requireJsonContentType(
							request.headers.get('content-type')
						)

						const body = await readRequestBody(request)
						const text = new TextDecoder().decode(body)

						try {
							return JSON.parse(text) as T
						} catch {
							throw new HttpError(400, 'Invalid JSON body')
						}
					},

					text: async () => {
						const body = await readRequestBody(request)
						return new TextDecoder().decode(body)
					}
				}

				const spongRes = RiserBobResponse()

				const result = await handler(spongReq, spongRes)

				if (result instanceof Response) {
					return result
				}

				console.error(
					`[RiserBob] 😭🧽 Oh no! RiserBob is sad! The Handler forgot to return a valid Response! 💔
  Method: ${request.method}
  Path: ${url.pathname}
  Expected: Response
  Received: ${result === undefined ? 'undefined' : typeof result}
  😢 RiserBob is crying in Bikini Bottom... 🍍`
				)
				return ErrorHandler.handle(
					new Error('Handler did not send a response')
				)
			} catch (error) {
				console.error(
					`[RiserBob] 😭🧽 Oh no! RiserBob is freaking out!
  Something went wrong while handling this request! 💥
  RiserBob: "Who lives in a pineapple under a bug?! 😱🍍"
  Error:`,
					error
				)

				return ErrorHandler.handle(error)
			}
		}
	})

	callback?.()

	return server
}
