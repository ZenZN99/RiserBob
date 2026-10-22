import type { SpongResponse } from '../../types/spong-response'
import { StatusCode } from './status-code'

export function RiserBobResponse(): SpongResponse {
	let responseStatus: number = StatusCode.OK
	const responseHeaders = new Headers()

	const assertFinalStatus = (status: number): void => {
		if (!Number.isInteger(status) || status < 200 || status > 599) {
			throw new RangeError(`Invalid Fetch Response status: ${status}`)
		}
	}

	const hasNullBody = (status: number): boolean => {
		return status === 204 || status === 205 || status === 304
	}

	const json = (data: unknown, status: number = responseStatus): Response => {
		assertFinalStatus(status)

		if (hasNullBody(status)) {
			throw new TypeError(`Status ${status} cannot have a response body`)
		}
		return Response.json(data, {
			status,
			headers: responseHeaders
		})
	}

	const empty = (status: number): Response => {
		assertFinalStatus(status)
		return new Response(null, {
			status,
			headers: responseHeaders
		})
	}

	const redirect = (status: number, url = '/'): Response => {
		const location = new URL(url, 'http://localhost')

		return new Response(null, {
			status,
			headers: new Headers([
				...responseHeaders.entries(),
				['Location', location.href]
			])
		})
	}

	return {
		send(body) {
			const headers = new Headers(responseHeaders)

			if (!headers.has('Content-Type') && typeof body === 'string') {
				headers.set('Content-Type', 'text/plain; charset=utf-8')
			}

			return new Response(body, {
				status: responseStatus,
				headers
			})
		},

		json,

		status(code) {
			responseStatus = code
			return this
		},

		header(name, value) {
			responseHeaders.set(name, value)
			return this
		},

		SpongContinue: () => empty(StatusCode.Continue),
		SpongSwitchingProtocols: () => empty(StatusCode.SwitchingProtocols),
		SpongProcessing: () => empty(StatusCode.Processing),
		SpongEarlyHints: () => empty(StatusCode.EarlyHints),

		SpongOK: (data = { message: 'OK' }) => json(data, StatusCode.OK),
		SpongCreated: (data = { message: 'Created' }) =>
			json(data, StatusCode.Created),
		SpongAccepted: (data = { message: 'Accepted' }) =>
			json(data, StatusCode.Accepted),
		SpongNonAuthoritativeInfo: (data = {}) =>
			json(data, StatusCode.NonAuthoritativeInfo),
		SpongNoContent: () => empty(StatusCode.NoContent),
		SpongResetContent: () => empty(StatusCode.ResetContent),
		SpongPartialContent: (data = {}) =>
			json(data, StatusCode.PartialContent),
		SpongMultiStatus: (data = {}) => json(data, StatusCode.MultiStatus),
		SpongAlreadyReported: (data = {}) =>
			json(data, StatusCode.AlreadyReported),
		SpongIMUsed: (data = {}) => json(data, StatusCode.IMUsed),

		SpongMultipleChoices: (data = {}) =>
			json(data, StatusCode.MultipleChoices),
		SpongMovedPermanently: (url) =>
			redirect(StatusCode.MovedPermanently, url),
		SpongFound: (url) => redirect(StatusCode.Found, url),
		SpongSeeOther: (url) => redirect(StatusCode.SeeOther, url),
		SpongNotModified: () => empty(StatusCode.NotModified),
		SpongUseProxy: (url) => redirect(StatusCode.UseProxy, url),
		SpongTemporaryRedirect: (url) =>
			redirect(StatusCode.TemporaryRedirect, url),
		SpongPermanentRedirect: (url) =>
			redirect(StatusCode.PermanentRedirect, url),

		SpongBadRequest: (data = { error: 'Bad Request' }) =>
			json(data, StatusCode.BadRequest),
		SpongUnauthorized: (data = { error: 'Unauthorized' }) =>
			json(data, StatusCode.Unauthorized),
		SpongPaymentRequired: (data = {}) =>
			json(data, StatusCode.PaymentRequired),
		SpongForbidden: (data = { error: 'Forbidden' }) =>
			json(data, StatusCode.Forbidden),
		SpongNotFound: (data = { error: 'Not Found' }) =>
			json(data, StatusCode.NotFound),
		SpongMethodNotAllowed: (data = {}) =>
			json(data, StatusCode.MethodNotAllowed),
		SpongNotAcceptable: (data = {}) => json(data, StatusCode.NotAcceptable),
		SpongProxyAuthenticationRequired: (data = {}) =>
			json(data, StatusCode.ProxyAuthenticationRequired),
		SpongRequestTimeout: (data = {}) =>
			json(data, StatusCode.RequestTimeout),
		SpongConflict: (data = {}) => json(data, StatusCode.Conflict),
		SpongGone: (data = {}) => json(data, StatusCode.Gone),
		SpongLengthRequired: (data = {}) =>
			json(data, StatusCode.LengthRequired),
		SpongPreconditionFailed: (data = {}) =>
			json(data, StatusCode.PreconditionFailed),
		SpongContentTooLarge: (data = {}) =>
			json(data, StatusCode.ContentTooLarge),
		SpongURITooLong: (data = {}) => json(data, StatusCode.URITooLong),
		SpongUnsupportedMediaType: (data = {}) =>
			json(data, StatusCode.UnsupportedMediaType),
		SpongRangeNotSatisfiable: (data = {}) =>
			json(data, StatusCode.RangeNotSatisfiable),
		SpongExpectationFailed: (data = {}) =>
			json(data, StatusCode.ExpectationFailed),
		SpongImATeapot: (data = { message: "I'm a teapot" }) =>
			json(data, StatusCode.ImATeapot),
		SpongMisdirectedRequest: (data = {}) =>
			json(data, StatusCode.MisdirectedRequest),
		SpongUnprocessableContent: (data = {}) =>
			json(data, StatusCode.UnprocessableContent),
		SpongLocked: (data = {}) => json(data, StatusCode.Locked),
		SpongFailedDependency: (data = {}) =>
			json(data, StatusCode.FailedDependency),
		SpongTooEarly: (data = {}) => json(data, StatusCode.TooEarly),
		SpongUpgradeRequired: (data = {}) =>
			json(data, StatusCode.UpgradeRequired),
		SpongPreconditionRequired: (data = {}) =>
			json(data, StatusCode.PreconditionRequired),
		SpongTooManyRequests: (data = {}) =>
			json(data, StatusCode.TooManyRequests),
		SpongRequestHeaderFieldsTooLarge: (data = {}) =>
			json(data, StatusCode.RequestHeaderFieldsTooLarge),
		SpongUnavailableForLegalReasons: (data = {}) =>
			json(data, StatusCode.UnavailableForLegalReasons),

		SpongInternalServerError: (data = { error: 'Internal Server Error' }) =>
			json(data, StatusCode.InternalServerError),
		SpongNotImplemented: (data = {}) =>
			json(data, StatusCode.NotImplemented),
		SpongBadGateway: (data = {}) => json(data, StatusCode.BadGateway),
		SpongServiceUnavailable: (data = {}) =>
			json(data, StatusCode.ServiceUnavailable),
		SpongGatewayTimeout: (data = {}) =>
			json(data, StatusCode.GatewayTimeout),
		SpongHTTPVersionNotSupported: (data = {}) =>
			json(data, StatusCode.HTTPVersionNotSupported),
		SpongVariantAlsoNegotiates: (data = {}) =>
			json(data, StatusCode.VariantAlsoNegotiates),
		SpongInsufficientStorage: (data = {}) =>
			json(data, StatusCode.InsufficientStorage),
		SpongLoopDetected: (data = {}) => json(data, StatusCode.LoopDetected),
		SpongNotExtended: (data = {}) => json(data, StatusCode.NotExtended),
		SpongNetworkAuthenticationRequired: (data = {}) =>
			json(data, StatusCode.NetworkAuthenticationRequired)
	}
}
