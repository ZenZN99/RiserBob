export interface SpongResponse {
	// Response basics
	send(body: string): Response
	json(data: unknown, status?: number): Response
	status(code: number): SpongResponse
	header(name: string, value: string): SpongResponse

	// 1xx — Informational
	SpongContinue(): Response // 100
	SpongSwitchingProtocols(): Response // 101
	SpongProcessing(): Response // 102
	SpongEarlyHints(): Response // 103

	// 2xx — Success
	SpongOK(data?: unknown): Response // 200
	SpongCreated(data?: unknown): Response // 201
	SpongAccepted(data?: unknown): Response // 202
	SpongNonAuthoritativeInfo(data?: unknown): Response // 203
	SpongNoContent(): Response // 204
	SpongResetContent(): Response // 205
	SpongPartialContent(data?: unknown): Response // 206
	SpongMultiStatus(data?: unknown): Response // 207
	SpongAlreadyReported(data?: unknown): Response // 208
	SpongIMUsed(data?: unknown): Response // 226

	// 3xx — Redirection
	SpongMultipleChoices(data?: unknown): Response // 300
	SpongMovedPermanently(url?: string): Response // 301
	SpongFound(url?: string): Response // 302
	SpongSeeOther(url?: string): Response // 303
	SpongNotModified(): Response // 304
	SpongUseProxy(url?: string): Response // 305
	SpongTemporaryRedirect(url?: string): Response // 307
	SpongPermanentRedirect(url?: string): Response // 308

	// 4xx — Client Errors
	SpongBadRequest(data?: unknown): Response // 400
	SpongUnauthorized(data?: unknown): Response // 401
	SpongPaymentRequired(data?: unknown): Response // 402
	SpongForbidden(data?: unknown): Response // 403
	SpongNotFound(data?: unknown): Response // 404
	SpongMethodNotAllowed(data?: unknown): Response // 405
	SpongNotAcceptable(data?: unknown): Response // 406
	SpongProxyAuthenticationRequired(data?: unknown): Response // 407
	SpongRequestTimeout(data?: unknown): Response // 408
	SpongConflict(data?: unknown): Response // 409
	SpongGone(data?: unknown): Response // 410
	SpongLengthRequired(data?: unknown): Response // 411
	SpongPreconditionFailed(data?: unknown): Response // 412
	SpongContentTooLarge(data?: unknown): Response // 413
	SpongURITooLong(data?: unknown): Response // 414
	SpongUnsupportedMediaType(data?: unknown): Response // 415
	SpongRangeNotSatisfiable(data?: unknown): Response // 416
	SpongExpectationFailed(data?: unknown): Response // 417
	SpongImATeapot(data?: unknown): Response // 418
	SpongMisdirectedRequest(data?: unknown): Response // 421
	SpongUnprocessableContent(data?: unknown): Response // 422
	SpongLocked(data?: unknown): Response // 423
	SpongFailedDependency(data?: unknown): Response // 424
	SpongTooEarly(data?: unknown): Response // 425
	SpongUpgradeRequired(data?: unknown): Response // 426
	SpongPreconditionRequired(data?: unknown): Response // 428
	SpongTooManyRequests(data?: unknown): Response // 429
	SpongRequestHeaderFieldsTooLarge(data?: unknown): Response // 431
	SpongUnavailableForLegalReasons(data?: unknown): Response // 451

	// 5xx — Server Errors
	SpongInternalServerError(data?: unknown): Response // 500
	SpongNotImplemented(data?: unknown): Response // 501
	SpongBadGateway(data?: unknown): Response // 502
	SpongServiceUnavailable(data?: unknown): Response // 503
	SpongGatewayTimeout(data?: unknown): Response // 504
	SpongHTTPVersionNotSupported(data?: unknown): Response // 505
	SpongVariantAlsoNegotiates(data?: unknown): Response // 506
	SpongInsufficientStorage(data?: unknown): Response // 507
	SpongLoopDetected(data?: unknown): Response // 508
	SpongNotExtended(data?: unknown): Response // 510
	SpongNetworkAuthenticationRequired(data?: unknown): Response // 511
}
