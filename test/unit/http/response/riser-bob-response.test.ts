import { describe, expect, test } from 'bun:test'
import { RiserBobResponse } from '../../../../src/http/response/riser-bob-response'
import { StatusCode } from '../../../../src/http/response/status-code'

type AnyMethod = (...args: unknown[]) => Response

/**
 * Looks a member up by name without fighting its per-method TypeScript signature
 * (and without tripping `noUncheckedIndexedAccess`). Fails loudly if it is missing.
 */
function member(target: unknown, name: string): AnyMethod {
  const value = (target as Record<string, unknown>)[name]

  if (typeof value !== 'function') {
    throw new TypeError(`Expected "${name}" to be a function`)
  }

  return value as AnyMethod
}

/** Calls a member by name as a normal method call (`this` is the target). */
function call(target: unknown, name: string, ...args: unknown[]): Response {
  return member(target, name).apply(target, args)
}

/** Replaces a member on an instance, the way a test double would. */
function override(target: unknown, name: string, replacement: AnyMethod): void {
  const record = target as Record<string, unknown>

  record[name] = replacement
}

const JSON_HELPERS = [
  ['SpongOK', 200, { message: 'OK' }],
  ['SpongCreated', 201, { message: 'Created' }],
  ['SpongAccepted', 202, { message: 'Accepted' }],
  ['SpongNonAuthoritativeInfo', 203, {}],
  ['SpongPartialContent', 206, {}],
  ['SpongMultiStatus', 207, {}],
  ['SpongAlreadyReported', 208, {}],
  ['SpongIMUsed', 226, {}],
  ['SpongMultipleChoices', 300, {}],
  ['SpongBadRequest', 400, { error: 'Bad Request' }],
  ['SpongUnauthorized', 401, { error: 'Unauthorized' }],
  ['SpongPaymentRequired', 402, {}],
  ['SpongForbidden', 403, { error: 'Forbidden' }],
  ['SpongNotFound', 404, { error: 'Not Found' }],
  ['SpongMethodNotAllowed', 405, {}],
  ['SpongNotAcceptable', 406, {}],
  ['SpongProxyAuthenticationRequired', 407, {}],
  ['SpongRequestTimeout', 408, {}],
  ['SpongConflict', 409, {}],
  ['SpongGone', 410, {}],
  ['SpongLengthRequired', 411, {}],
  ['SpongPreconditionFailed', 412, {}],
  ['SpongContentTooLarge', 413, {}],
  ['SpongURITooLong', 414, {}],
  ['SpongUnsupportedMediaType', 415, {}],
  ['SpongRangeNotSatisfiable', 416, {}],
  ['SpongExpectationFailed', 417, {}],
  ['SpongImATeapot', 418, { message: "I'm a teapot" }],
  ['SpongMisdirectedRequest', 421, {}],
  ['SpongUnprocessableContent', 422, {}],
  ['SpongLocked', 423, {}],
  ['SpongFailedDependency', 424, {}],
  ['SpongTooEarly', 425, {}],
  ['SpongUpgradeRequired', 426, {}],
  ['SpongPreconditionRequired', 428, {}],
  ['SpongTooManyRequests', 429, {}],
  ['SpongRequestHeaderFieldsTooLarge', 431, {}],
  ['SpongUnavailableForLegalReasons', 451, {}],
  ['SpongInternalServerError', 500, { error: 'Internal Server Error' }],
  ['SpongNotImplemented', 501, {}],
  ['SpongBadGateway', 502, {}],
  ['SpongServiceUnavailable', 503, {}],
  ['SpongGatewayTimeout', 504, {}],
  ['SpongHTTPVersionNotSupported', 505, {}],
  ['SpongVariantAlsoNegotiates', 506, {}],
  ['SpongInsufficientStorage', 507, {}],
  ['SpongLoopDetected', 508, {}],
  ['SpongNotExtended', 510, {}],
  ['SpongNetworkAuthenticationRequired', 511, {}],
] as const

const EMPTY_HELPERS = [
  ['SpongNoContent', 204],
  ['SpongResetContent', 205],
  ['SpongNotModified', 304],
] as const

const INFORMATIONAL_HELPERS = [
  ['SpongContinue', 100],
  ['SpongSwitchingProtocols', 101],
  ['SpongProcessing', 102],
  ['SpongEarlyHints', 103],
] as const

const REDIRECT_HELPERS = [
  ['SpongMovedPermanently', 301],
  ['SpongFound', 302],
  ['SpongSeeOther', 303],
  ['SpongUseProxy', 305],
  ['SpongTemporaryRedirect', 307],
  ['SpongPermanentRedirect', 308],
] as const

const API_MEMBERS = [
  'send',
  'json',
  'status',
  'header',
  ...JSON_HELPERS.map(([name]) => name),
  ...EMPTY_HELPERS.map(([name]) => name),
  ...INFORMATIONAL_HELPERS.map(([name]) => name),
  ...REDIRECT_HELPERS.map(([name]) => name),
]

describe('RiserBobResponse', () => {
  describe('public API', () => {
    test('should expose all 66 members as functions', () => {
      expect(API_MEMBERS).toHaveLength(66)

      const response = RiserBobResponse()

      for (const name of API_MEMBERS) {
        expect(typeof (response as unknown as Record<string, unknown>)[name]).toBe('function')
      }
    })

    test('should be callable without arguments', () => {
      expect(RiserBobResponse.length).toBe(0)
      expect(RiserBobResponse()).toBeDefined()
    })

    test('should return a new instance for every call', () => {
      expect(RiserBobResponse()).not.toBe(RiserBobResponse())
    })
  })

  describe('send()', () => {
    test('should return a Response with the default status 200', async () => {
      const response = RiserBobResponse().send('Hello RiserBob')

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(StatusCode.OK)
      expect(await response.text()).toBe('Hello RiserBob')
    })

    test('should use the configured status', () => {
      const response = RiserBobResponse().status(StatusCode.Created).send('Created')

      expect(response.status).toBe(StatusCode.Created)
    })

    test('should include configured headers', () => {
      const response = RiserBobResponse().header('X-Powered-By', 'RiserBob').send('Hello')

      expect(response.headers.get('X-Powered-By')).toBe('RiserBob')
    })

    test('should set Content-Type for string bodies', () => {
      const response = RiserBobResponse().send('Hello')

      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    })

    test('should set Content-Type for string bodies with other headers', () => {
      const response = RiserBobResponse().header('X-Test', '1').send('Hello')

      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
      expect(response.headers.get('x-test')).toBe('1')
    })

    test('should keep a custom Content-Type for string bodies', () => {
      const response = RiserBobResponse().header('Content-Type', 'text/html').send('<h1>Hello</h1>')

      expect(response.headers.get('content-type')).toBe('text/html')
    })

    test('should not add a text Content-Type to binary bodies', async () => {
      // The public type only accepts strings, but the runtime forwards any BodyInit.
      const response = call(RiserBobResponse(), 'send', new Uint8Array([1, 2, 3]))

      expect(response.headers.get('content-type')).toBeNull()
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    })

    test('should support a null body', async () => {
      const response = call(RiserBobResponse(), 'send', null)

      expect(response.status).toBe(StatusCode.OK)
      expect(await response.text()).toBe('')
    })

    test('should reject an invalid configured status', () => {
      expect(() => RiserBobResponse().status(99).send('x')).toThrow(RangeError)
    })

    test('should not mutate the stored headers when sending', () => {
      const builder = RiserBobResponse().header('X-Test', '1')
      const first = builder.send('one')
      builder.header('X-Test', '2')
      const second = builder.send('two')

      expect(first.headers.get('x-test')).toBe('1')
      expect(second.headers.get('x-test')).toBe('2')
    })
  })

  describe('json()', () => {
    test('should return JSON with status 200 by default', async () => {
      const data = { message: 'Hello', count: 2 }
      const response = RiserBobResponse().json(data)

      expect(response.status).toBe(StatusCode.OK)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(await response.json()).toEqual(data)
    })

    test('should use the configured status', async () => {
      const response = RiserBobResponse().status(StatusCode.Created).json({ id: 1 })

      expect(response.status).toBe(StatusCode.Created)
      expect(await response.json()).toEqual({ id: 1 })
    })

    test('should accept an explicit status', () => {
      const response = RiserBobResponse().json({ error: 'Not Found' }, StatusCode.NotFound)

      expect(response.status).toBe(StatusCode.NotFound)
    })

    test('should prefer the explicit status over the configured one', () => {
      const response = RiserBobResponse()
        .status(StatusCode.Accepted)
        .json({}, StatusCode.BadRequest)

      expect(response.status).toBe(StatusCode.BadRequest)
    })

    test('should fall back to the configured status when status is undefined', () => {
      const response = RiserBobResponse().status(StatusCode.Accepted).json({}, undefined)

      expect(response.status).toBe(StatusCode.Accepted)
    })

    test('should preserve configured headers', () => {
      const response = RiserBobResponse()
        .header('X-Request-Id', 'request-123')
        .json({ success: true })

      expect(response.headers.get('X-Request-Id')).toBe('request-123')
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    test('should keep a custom Content-Type', () => {
      const response = RiserBobResponse()
        .header('Content-Type', 'application/vnd.api+json')
        .json({ data: [] })

      expect(response.headers.get('content-type')).toBe('application/vnd.api+json')
    })

    test('should serialize null and nested data', async () => {
      expect(await RiserBobResponse().json(null).json()).toBeNull()
      expect(
        await RiserBobResponse()
          .json({ a: { b: [1, 2, { c: 3 }] } })
          .json(),
      ).toEqual({ a: { b: [1, 2, { c: 3 }] } })
    })

    test.each([204, 205, 304])('should reject JSON responses with status %i', (status) => {
      expect(() => RiserBobResponse().json({ message: 'Hello' }, status)).toThrow(TypeError)
    })

    test.each([204, 205, 304])(
      'should reject JSON responses when the configured status is %i',
      (status) => {
        expect(() => RiserBobResponse().status(status).json({})).toThrow(TypeError)
      },
    )

    test('should reject status codes below 200', () => {
      expect(() => RiserBobResponse().json({}, 199)).toThrow(RangeError)
    })

    test('should reject status codes above 599', () => {
      expect(() => RiserBobResponse().json({}, 600)).toThrow(RangeError)
    })

    test.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, -1])(
      'should reject the invalid status %p',
      (status) => {
        expect(() => RiserBobResponse().json({}, status)).toThrow(RangeError)
      },
    )

    test('should report the invalid status in the error message', () => {
      expect(() => RiserBobResponse().json({}, 99)).toThrow('Invalid Fetch Response status: 99')
      expect(() => RiserBobResponse().json({}, 204)).toThrow(
        'Status 204 cannot have a response body',
      )
    })
  })

  describe('status()', () => {
    test('should support chaining', () => {
      const responseBuilder = RiserBobResponse()

      expect(responseBuilder.status(StatusCode.Created)).toBe(responseBuilder)
    })

    test('should use the latest configured status', () => {
      const response = RiserBobResponse()
        .status(StatusCode.Accepted)
        .status(StatusCode.Created)
        .send('Created')

      expect(response.status).toBe(StatusCode.Created)
    })

    test('should not affect other instances', () => {
      const first = RiserBobResponse().status(StatusCode.NotFound)
      const second = RiserBobResponse()

      expect(first.send('a').status).toBe(StatusCode.NotFound)
      expect(second.send('b').status).toBe(StatusCode.OK)
    })
  })

  describe('header()', () => {
    test('should support chaining', () => {
      const responseBuilder = RiserBobResponse()

      expect(responseBuilder.header('X-Test', 'value')).toBe(responseBuilder)
    })

    test('should allow multiple headers', () => {
      const response = RiserBobResponse().header('X-One', '1').header('X-Two', '2').send('OK')

      expect(response.headers.get('X-One')).toBe('1')
      expect(response.headers.get('X-Two')).toBe('2')
    })

    test('should replace a header with the same name', () => {
      const response = RiserBobResponse().header('X-Test', 'old').header('X-Test', 'new').send('OK')

      expect(response.headers.get('X-Test')).toBe('new')
    })

    test('should treat header names as case-insensitive', () => {
      const response = RiserBobResponse().header('X-Test', 'old').header('x-test', 'new').json({})

      expect(response.headers.get('X-Test')).toBe('new')
    })

    test('should reject an invalid header name', () => {
      expect(() => RiserBobResponse().header('bad name', 'x')).toThrow(TypeError)
    })

    test('should reject an invalid header value', () => {
      expect(() => RiserBobResponse().header('X-Test', 'a\nb')).toThrow(TypeError)
    })

    test('should keep multiple Set-Cookie headers separated', () => {
      const response = RiserBobResponse().header('Set-Cookie', 'a=1').json({})

      expect(response.headers.getSetCookie()).toEqual(['a=1'])
    })
  })

  describe('empty responses', () => {
    test.each(EMPTY_HELPERS)(
      '%s should return status %i without a body',
      async (method, status) => {
        const response = call(RiserBobResponse(), method)

        expect(response.status).toBe(status)
        expect(await response.text()).toBe('')
      },
    )

    test('should preserve headers on empty responses', () => {
      const response = RiserBobResponse().header('X-Request-Id', 'abc').SpongNoContent()

      expect(response.status).toBe(204)
      expect(response.headers.get('X-Request-Id')).toBe('abc')
    })

    test('should not add a Content-Type to empty responses', () => {
      expect(RiserBobResponse().SpongNoContent().headers.get('content-type')).toBeNull()
    })

    test.each(INFORMATIONAL_HELPERS)(
      '%s throws RangeError (1xx is rejected by the final-status check)',
      (method) => {
        expect(() => call(RiserBobResponse(), method)).toThrow(RangeError)
      },
    )
  })

  describe('status helpers', () => {
    test.each(JSON_HELPERS)(
      '%s should return status %i with its default payload',
      async (method, status, defaultPayload) => {
        const response = call(RiserBobResponse(), method)

        expect(response.status).toBe(status)
        expect(response.headers.get('content-type')).toContain('application/json')
        expect(await response.json()).toEqual(defaultPayload)
      },
    )

    test.each(JSON_HELPERS)('%s should accept a custom payload', async (method, status) => {
      const payload = { custom: true, method }
      const response = call(RiserBobResponse(), method, payload)

      expect(response.status).toBe(status)
      expect(await response.json()).toEqual(payload)
    })

    test.each(JSON_HELPERS)(
      '%s should ignore the status configured with status()',
      (method, status) => {
        const response = call(RiserBobResponse().status(418), method)

        expect(response.status).toBe(status)
      },
    )

    test.each(JSON_HELPERS)('%s should preserve custom headers', (method) => {
      const response = call(RiserBobResponse().header('X-Request-Id', 'abc'), method)

      expect(response.headers.get('x-request-id')).toBe('abc')
    })

    test('should use explicit falsy payloads instead of the default', async () => {
      expect(await call(RiserBobResponse(), 'SpongOK', null).json()).toBeNull()
      expect(await call(RiserBobResponse(), 'SpongOK', 0).json()).toBe(0)
      expect(await call(RiserBobResponse(), 'SpongOK', '').json()).toBe('')
      expect(await call(RiserBobResponse(), 'SpongOK', false).json()).toBe(false)
    })

    test('should use the default payload when undefined is passed', async () => {
      expect(await call(RiserBobResponse(), 'SpongOK', undefined).json()).toEqual({
        message: 'OK',
      })
    })

    test('SpongCreated should work in the documented chain', async () => {
      const response = RiserBobResponse()
        .status(201)
        .header('X-Powered-By', 'RiserBob')
        .SpongCreated({ message: 'Created' })

      expect(response.status).toBe(201)
      expect(response.headers.get('x-powered-by')).toBe('RiserBob')
      expect(await response.json()).toEqual({ message: 'Created' })
    })
  })

  describe('redirect()', () => {
    test.each(REDIRECT_HELPERS)(
      '%s should return status %i with a Location header',
      async (method, status) => {
        const response = call(RiserBobResponse(), method, '/products')

        expect(response.status).toBe(status)
        expect(response.headers.get('location')).toBe('http://localhost/products')
        expect(await response.text()).toBe('')
      },
    )

    test.each(REDIRECT_HELPERS)('%s should default the URL to "/"', (method) => {
      const response = call(RiserBobResponse(), method)

      expect(response.headers.get('location')).toBe('http://localhost/')
    })

    test('SpongFound should return status 302', () => {
      const response = RiserBobResponse().SpongFound('/products')

      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost/products')
    })

    test('SpongMovedPermanently should return status 301', () => {
      const response = RiserBobResponse().SpongMovedPermanently('/')

      expect(response.status).toBe(301)
      expect(response.headers.get('location')).toBe('http://localhost/')
    })

    test('should preserve custom headers on redirects', () => {
      const response = RiserBobResponse()
        .header('X-Request-Id', 'redirect-123')
        .SpongFound('/login')

      expect(response.headers.get('X-Request-Id')).toBe('redirect-123')
      expect(response.headers.get('location')).toBe('http://localhost/login')
    })

    test('should resolve relative paths against the default base URL', () => {
      const response = RiserBobResponse().SpongSeeOther('login')

      expect(response.headers.get('location')).toBe('http://localhost/login')
    })

    test('should keep absolute URLs', () => {
      const response = RiserBobResponse().SpongFound('https://example.com/a?b=1')

      expect(response.headers.get('location')).toBe('https://example.com/a?b=1')
    })

    test('should normalize the URL through the URL parser', () => {
      const response = RiserBobResponse().SpongFound('/a b?c=1 2')

      expect(response.headers.get('location')).toBe('http://localhost/a%20b?c=1%202')
    })

    test('should ignore the status configured with status()', () => {
      const response = RiserBobResponse().status(500).SpongFound('/x')

      expect(response.status).toBe(302)
    })

    test('should reject an invalid URL', () => {
      expect(() => RiserBobResponse().SpongFound('http://')).toThrow(TypeError)
    })

    // Documents the existing behaviour: Location is appended after the
    // custom headers, so a manually set Location is combined with the new one.
    test('should append Location after a manually set Location header', () => {
      const response = RiserBobResponse().header('Location', '/old').SpongFound('/new')

      expect(response.headers.get('location')).toBe('/old, http://localhost/new')
    })

    test('should keep Set-Cookie on redirects', () => {
      const response = RiserBobResponse().header('Set-Cookie', 'session=abc').SpongSeeOther('/home')

      expect(response.headers.getSetCookie()).toEqual(['session=abc'])
    })

    test('should not mutate the stored headers', () => {
      const builder = RiserBobResponse().header('X-Test', '1')
      builder.SpongFound('/a')
      const response = builder.json({})

      expect(response.headers.get('location')).toBeNull()
    })
  })

  describe('isolation between instances', () => {
    test('should not share headers between instances', () => {
      const first = RiserBobResponse().header('X-First', '1')
      const second = RiserBobResponse().header('X-Second', '2')

      const firstResponse = first.json({})
      const secondResponse = second.json({})

      expect(firstResponse.headers.get('x-first')).toBe('1')
      expect(firstResponse.headers.get('x-second')).toBeNull()
      expect(secondResponse.headers.get('x-second')).toBe('2')
      expect(secondResponse.headers.get('x-first')).toBeNull()
    })

    test('should not leak headers into an untouched instance', () => {
      RiserBobResponse().header('X-Leak', '1').status(500)

      const clean = RiserBobResponse().json({})

      expect(clean.status).toBe(200)
      expect(clean.headers.get('x-leak')).toBeNull()
    })

    test('should keep a Response independent from later builder changes', () => {
      const builder = RiserBobResponse().header('X-Test', '1')
      const response = builder.json({})

      builder.header('X-Test', '2').header('X-Later', 'yes')

      expect(response.headers.get('x-test')).toBe('1')
      expect(response.headers.get('x-later')).toBeNull()
    })

    test('should not be contaminated by mutating a returned Response', () => {
      const first = RiserBobResponse().send('one')
      first.headers.set('X-Evil', '1')
      first.headers.set('Content-Type', 'evil')

      const second = RiserBobResponse().send('two')

      expect(second.headers.get('x-evil')).toBeNull()
      expect(second.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    })

    test('should stay isolated across many concurrent requests', async () => {
      const statuses = [200, 201, 202, 203, 206]
      const statusFor = (index: number): number => statuses[index % statuses.length] ?? 200

      const handle = async (index: number) => {
        const builder = RiserBobResponse().status(statusFor(index)).header('X-Id', String(index))

        await new Promise((resolve) => setTimeout(resolve, Math.random() * 3))

        if (index % 3 === 0) builder.header('X-Three', 'yes')

        await Promise.resolve()

        const response = index % 2 === 0 ? builder.send(`id:${index}`) : builder.json({ index })

        return {
          index,
          status: response.status,
          id: response.headers.get('x-id'),
          three: response.headers.get('x-three'),
          body: await response.text(),
        }
      }

      const results = await Promise.all(Array.from({ length: 1000 }, (_, index) => handle(index)))

      for (const result of results) {
        expect(result.id).toBe(String(result.index))
        expect(result.status).toBe(statusFor(result.index))
        expect(result.three).toBe(result.index % 3 === 0 ? 'yes' : null)
        expect(result.body).toBe(
          result.index % 2 === 0 ? `id:${result.index}` : JSON.stringify({ index: result.index }),
        )
      }
    })
  })

  describe('detached and reassigned methods', () => {
    test('should work when helpers are destructured', async () => {
      const { SpongOK, json, send } = RiserBobResponse()

      expect((SpongOK() as Response).status).toBe(200)
      expect((json({ a: 1 }) as Response).status).toBe(200)
      expect(await (send('x') as Response).text()).toBe('x')
    })

    test.each(JSON_HELPERS)('%s should work when extracted as a callback', (method, status) => {
      const fn = member(RiserBobResponse(), method)

      expect(fn().status).toBe(status)
    })

    test('should apply detached status() and header() to the instance', () => {
      const builder = RiserBobResponse()
      const { status, header } = builder

      status(StatusCode.Created)
      header('X-Detached', 'yes')

      const response = builder.json({})

      expect(response.status).toBe(StatusCode.Created)
      expect(response.headers.get('x-detached')).toBe('yes')
    })

    test('should read live state from a detached json()', () => {
      const builder = RiserBobResponse()
      const { json } = builder

      builder.status(StatusCode.Accepted).header('X-Late', '1')

      const response = json({}) as Response

      expect(response.status).toBe(StatusCode.Accepted)
      expect(response.headers.get('x-late')).toBe('1')
    })

    test('should allow replacing json() with a mock', () => {
      const builder = RiserBobResponse()
      override(builder, 'json', () => new Response('mocked'))

      expect(builder.json({})).toBeInstanceOf(Response)
    })

    test('should allow replacing a status helper with a mock', async () => {
      const builder = RiserBobResponse()
      override(builder, 'SpongOK', () => new Response('mocked-ok'))

      expect(await builder.SpongOK().text()).toBe('mocked-ok')
    })

    test('should keep helpers independent from a replaced json()', () => {
      const builder = RiserBobResponse()
      override(builder, 'json', () => new Response('mocked'))

      expect(builder.SpongOK().status).toBe(200)
    })

    test('should not leak a replaced method to other instances', () => {
      const first = RiserBobResponse()
      const second = RiserBobResponse()
      override(first, 'json', () => new Response('mocked'))

      expect(second.json({ real: true }).headers.get('content-type')).toContain('application/json')
    })

    test('should allow attaching extra properties to the instance', () => {
      const builder = RiserBobResponse() as ReturnType<typeof RiserBobResponse> & {
        user?: { id: number }
      }
      builder.user = { id: 1 }

      expect(builder.user).toEqual({ id: 1 })
      expect(builder.SpongOK().status).toBe(200)
    })
  })
})
