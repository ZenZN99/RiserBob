import type { SpongResponse } from '../../types/spong-response'
import { StatusCode } from './status-code'

type SendBody = Parameters<SpongResponse['send']>[0]
type RedirectUrl = Parameters<SpongResponse['SpongFound']>[0]

type EmptyMethod = () => Response
type JsonMethod = (data?: unknown) => Response
type RedirectMethod = (url?: RedirectUrl) => Response

/**
 * Headers for string bodies when the developer did not set any headers.
 * Frozen and never mutated: the Response constructor copies it, so it is
 * not shared mutable state between requests.
 */
const TEXT_PLAIN_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/plain; charset=utf-8',
})

function assertFinalStatus(status: number): void {
  if (!Number.isInteger(status) || status < 200 || status > 599) {
    throw new RangeError(`Invalid Fetch Response status: ${status}`)
  }
}

function hasNullBody(status: number): boolean {
  return status === 204 || status === 205 || status === 304
}

function jsonResponse(data: unknown, status: number, headers: Headers | undefined): Response {
  assertFinalStatus(status)

  if (hasNullBody(status)) {
    throw new TypeError(`Status ${status} cannot have a response body`)
  }

  return headers === undefined
    ? Response.json(data, { status })
    : Response.json(data, { status, headers })
}

function emptyResponse(status: number, headers: Headers | undefined): Response {
  assertFinalStatus(status)

  return headers === undefined
    ? new Response(null, { status })
    : new Response(null, { status, headers })
}

function redirectResponse(
  status: number,
  url: string = '/',
  headers: Headers | undefined,
): Response {
  const location = new URL(url, 'http://localhost')

  if (headers === undefined) {
    return new Response(null, {
      status,
      headers: { Location: location.href },
    })
  }

  // Same semantics as before: custom headers are copied into a fresh
  // Headers object and Location is appended after them.
  const copy = new Headers(headers)
  copy.append('Location', location.href)

  return new Response(null, { status, headers: copy })
}

/**
 * Per-request response manager.
 *
 * Only two things are allocated per request: this instance and, lazily, a
 * Headers object the first time `header()` is called. The logic itself lives
 * once at module level (the helpers above) and once on the prototype (the
 * accessors below).
 *
 * Every public member is a prototype *getter* that returns a small closure
 * bound to the instance, instead of a prototype method. That is deliberate:
 * the previous implementation created every method as an arrow function, so
 * `const { SpongOK, json } = res`, `const fn = res.SpongNotFound` and
 * `res.json = mock` all worked. Plain prototype methods would lose `this`
 * in those cases. A getter keeps them working, and the closure is only
 * allocated for members that are actually used.
 */
class RiserBobResponseManager implements SpongResponse {
  #status: number = StatusCode.OK
  #headers: Headers | undefined = undefined

  get send(): (body: SendBody) => Response {
    return (body: SendBody): Response => {
      const customHeaders = this.#headers
      const isString = typeof body === 'string'

      if (customHeaders === undefined) {
        return isString
          ? new Response(body, {
              status: this.#status,
              headers: TEXT_PLAIN_HEADERS,
            })
          : new Response(body, { status: this.#status })
      }

      const headers = new Headers(customHeaders)

      if (isString && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'text/plain; charset=utf-8')
      }

      return new Response(body, { status: this.#status, headers })
    }
  }

  get json(): (data: unknown, status?: number) => Response {
    return (data: unknown, status: number = this.#status): Response =>
      jsonResponse(data, status, this.#headers)
  }

  get status(): (code: number) => this {
    return (code: number): this => {
      this.#status = code
      return this
    }
  }

  get header(): (name: string, value: string) => this {
    return (name: string, value: string): this => {
      if (this.#headers === undefined) {
        this.#headers = new Headers()
      }
      this.#headers.set(name, value)
      return this
    }
  }

  get SpongContinue(): EmptyMethod {
    return () => emptyResponse(StatusCode.Continue, this.#headers)
  }

  get SpongSwitchingProtocols(): EmptyMethod {
    return () => emptyResponse(StatusCode.SwitchingProtocols, this.#headers)
  }

  get SpongProcessing(): EmptyMethod {
    return () => emptyResponse(StatusCode.Processing, this.#headers)
  }

  get SpongEarlyHints(): EmptyMethod {
    return () => emptyResponse(StatusCode.EarlyHints, this.#headers)
  }

  get SpongOK(): JsonMethod {
    return (data: unknown = { message: 'OK' }) => jsonResponse(data, StatusCode.OK, this.#headers)
  }

  get SpongCreated(): JsonMethod {
    return (data: unknown = { message: 'Created' }) =>
      jsonResponse(data, StatusCode.Created, this.#headers)
  }

  get SpongAccepted(): JsonMethod {
    return (data: unknown = { message: 'Accepted' }) =>
      jsonResponse(data, StatusCode.Accepted, this.#headers)
  }

  get SpongNonAuthoritativeInfo(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.NonAuthoritativeInfo, this.#headers)
  }

  get SpongNoContent(): EmptyMethod {
    return () => emptyResponse(StatusCode.NoContent, this.#headers)
  }

  get SpongResetContent(): EmptyMethod {
    return () => emptyResponse(StatusCode.ResetContent, this.#headers)
  }

  get SpongPartialContent(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.PartialContent, this.#headers)
  }

  get SpongMultiStatus(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.MultiStatus, this.#headers)
  }

  get SpongAlreadyReported(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.AlreadyReported, this.#headers)
  }

  get SpongIMUsed(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.IMUsed, this.#headers)
  }

  get SpongMultipleChoices(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.MultipleChoices, this.#headers)
  }

  get SpongMovedPermanently(): RedirectMethod {
    return (url?: RedirectUrl) => redirectResponse(StatusCode.MovedPermanently, url, this.#headers)
  }

  get SpongFound(): RedirectMethod {
    return (url?: RedirectUrl) => redirectResponse(StatusCode.Found, url, this.#headers)
  }

  get SpongSeeOther(): RedirectMethod {
    return (url?: RedirectUrl) => redirectResponse(StatusCode.SeeOther, url, this.#headers)
  }

  get SpongNotModified(): EmptyMethod {
    return () => emptyResponse(StatusCode.NotModified, this.#headers)
  }

  get SpongUseProxy(): RedirectMethod {
    return (url?: RedirectUrl) => redirectResponse(StatusCode.UseProxy, url, this.#headers)
  }

  get SpongTemporaryRedirect(): RedirectMethod {
    return (url?: RedirectUrl) => redirectResponse(StatusCode.TemporaryRedirect, url, this.#headers)
  }

  get SpongPermanentRedirect(): RedirectMethod {
    return (url?: RedirectUrl) => redirectResponse(StatusCode.PermanentRedirect, url, this.#headers)
  }

  get SpongBadRequest(): JsonMethod {
    return (data: unknown = { error: 'Bad Request' }) =>
      jsonResponse(data, StatusCode.BadRequest, this.#headers)
  }

  get SpongUnauthorized(): JsonMethod {
    return (data: unknown = { error: 'Unauthorized' }) =>
      jsonResponse(data, StatusCode.Unauthorized, this.#headers)
  }

  get SpongPaymentRequired(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.PaymentRequired, this.#headers)
  }

  get SpongForbidden(): JsonMethod {
    return (data: unknown = { error: 'Forbidden' }) =>
      jsonResponse(data, StatusCode.Forbidden, this.#headers)
  }

  get SpongNotFound(): JsonMethod {
    return (data: unknown = { error: 'Not Found' }) =>
      jsonResponse(data, StatusCode.NotFound, this.#headers)
  }

  get SpongMethodNotAllowed(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.MethodNotAllowed, this.#headers)
  }

  get SpongNotAcceptable(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.NotAcceptable, this.#headers)
  }

  get SpongProxyAuthenticationRequired(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.ProxyAuthenticationRequired, this.#headers)
  }

  get SpongRequestTimeout(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.RequestTimeout, this.#headers)
  }

  get SpongConflict(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.Conflict, this.#headers)
  }

  get SpongGone(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.Gone, this.#headers)
  }

  get SpongLengthRequired(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.LengthRequired, this.#headers)
  }

  get SpongPreconditionFailed(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.PreconditionFailed, this.#headers)
  }

  get SpongContentTooLarge(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.ContentTooLarge, this.#headers)
  }

  get SpongURITooLong(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.URITooLong, this.#headers)
  }

  get SpongUnsupportedMediaType(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.UnsupportedMediaType, this.#headers)
  }

  get SpongRangeNotSatisfiable(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.RangeNotSatisfiable, this.#headers)
  }

  get SpongExpectationFailed(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.ExpectationFailed, this.#headers)
  }

  get SpongImATeapot(): JsonMethod {
    return (data: unknown = { message: "I'm a teapot" }) =>
      jsonResponse(data, StatusCode.ImATeapot, this.#headers)
  }

  get SpongMisdirectedRequest(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.MisdirectedRequest, this.#headers)
  }

  get SpongUnprocessableContent(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.UnprocessableContent, this.#headers)
  }

  get SpongLocked(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.Locked, this.#headers)
  }

  get SpongFailedDependency(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.FailedDependency, this.#headers)
  }

  get SpongTooEarly(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.TooEarly, this.#headers)
  }

  get SpongUpgradeRequired(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.UpgradeRequired, this.#headers)
  }

  get SpongPreconditionRequired(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.PreconditionRequired, this.#headers)
  }

  get SpongTooManyRequests(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.TooManyRequests, this.#headers)
  }

  get SpongRequestHeaderFieldsTooLarge(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.RequestHeaderFieldsTooLarge, this.#headers)
  }

  get SpongUnavailableForLegalReasons(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.UnavailableForLegalReasons, this.#headers)
  }

  get SpongInternalServerError(): JsonMethod {
    return (data: unknown = { error: 'Internal Server Error' }) =>
      jsonResponse(data, StatusCode.InternalServerError, this.#headers)
  }

  get SpongNotImplemented(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.NotImplemented, this.#headers)
  }

  get SpongBadGateway(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.BadGateway, this.#headers)
  }

  get SpongServiceUnavailable(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.ServiceUnavailable, this.#headers)
  }

  get SpongGatewayTimeout(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.GatewayTimeout, this.#headers)
  }

  get SpongHTTPVersionNotSupported(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.HTTPVersionNotSupported, this.#headers)
  }

  get SpongVariantAlsoNegotiates(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.VariantAlsoNegotiates, this.#headers)
  }

  get SpongInsufficientStorage(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.InsufficientStorage, this.#headers)
  }

  get SpongLoopDetected(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.LoopDetected, this.#headers)
  }

  get SpongNotExtended(): JsonMethod {
    return (data: unknown = {}) => jsonResponse(data, StatusCode.NotExtended, this.#headers)
  }

  get SpongNetworkAuthenticationRequired(): JsonMethod {
    return (data: unknown = {}) =>
      jsonResponse(data, StatusCode.NetworkAuthenticationRequired, this.#headers)
  }
}

/**
 * Members are accessors so they stay detachable (see the class comment), but
 * the old object exposed them as plain writable properties. Give every
 * accessor a setter that turns an assignment into an own property on that
 * instance, so `res.json = mock` keeps working. Runs once at module load.
 */
for (const key of Object.getOwnPropertyNames(RiserBobResponseManager.prototype)) {
  const descriptor = Object.getOwnPropertyDescriptor(RiserBobResponseManager.prototype, key)

  if (descriptor?.get === undefined) continue

  Object.defineProperty(RiserBobResponseManager.prototype, key, {
    ...descriptor,
    set(this: object, value: unknown) {
      Object.defineProperty(this, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      })
    },
  })
}

export function RiserBobResponse(): SpongResponse {
  return new RiserBobResponseManager()
}
