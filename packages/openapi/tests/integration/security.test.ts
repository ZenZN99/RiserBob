import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { OpenAPI, OpenAPIValidationError, type OpenAPIOptions } from '../../src/index'
import { escapeHtml, renderHtml, renderInitScript } from '../../src/ui/swagger-ui'
import { catchError, options } from '../helpers/app'
import { SpongMethod } from '../../../../src/types/spong-method'
import { RiserBob } from 'riser-bob'

const servers: Array<{ stop(force?: boolean): unknown }> = []

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.stop(true)
  }
})

function serve(app: RiserBob) {
  const server = app.spongListen(0)
  servers.push(server)

  return {
    server,
    base: `http://127.0.0.1:${server.port}`,
  }
}

const ok = { 200: { description: 'ok' } }

describe('Security', () => {
  test('malformed configuration never gets past the constructor', () => {
    for (const bad of [undefined, null, 42, 'str', [], () => {}]) {
      expect(catchError(() => new OpenAPI(bad as never))).toBeInstanceOf(OpenAPIValidationError)
    }

    expect(
      catchError(
        () =>
          new OpenAPI({
            info: { title: 'a', version: '1' },
            routes: [],
          } as never),
      ).message,
    ).toContain('routes')
  })

  test('unknown top-level options are rejected (e.g. a typo of "securitySchemes")', () => {
    const bad = {
      info: { title: 'a', version: '1' },
      routes: {},
      securitySchemas: {},
    }

    expect(catchError(() => new OpenAPI(bad as never)).message).toContain(
      'unknown property "securitySchemas"',
    )
  })

  test('unexpected route metadata is rejected rather than copied into the document', () => {
    const bad = {
      info: { title: 'a', version: '1' },
      routes: {
        a: {
          method: 'GET',
          path: '/a',
          response: ok,
          'x-internal': { secret: 1 },
          openapi: { summary: 'x' },
        },
      },
    }

    const message = catchError(() => new OpenAPI(bad as never)).message

    expect(message).toContain('unknown property "x-internal"')
    expect(message).toContain('unknown property "openapi"')
  })

  test('invalid schema input (non-rule values, prototype tricks) is rejected', () => {
    for (const body of [
      { a: { required: true } },
      { a: [{ toString: () => 'required' }] },
      { a: [['required']] },
      'x',
    ]) {
      const bad = {
        info: { title: 'a', version: '1' },
        routes: {
          a: {
            method: 'POST',
            path: '/a',
            request: { body },
            response: ok,
          },
        },
      }

      expect(catchError(() => new OpenAPI(bad as never))).toBeInstanceOf(OpenAPIValidationError)
    }
  })

  test('a "__proto__" documentation key is just data: nothing is polluted and paths stay clean', () => {
    const routes = JSON.parse(
      '{"__proto__":{"method":"GET","path":"/p","response":{"200":{"description":"ok"}}}}',
    ) as OpenAPIOptions['routes']

    const bob = new RiserBob()

    bob.spongGet('/p', (_spongRes, spongRes) => spongRes.json({}))

    const document = new OpenAPI(options({ routes })).generate(bob)

    expect(Object.keys(document.paths)).toEqual(['/p'])
    expect(document.paths['/p']?.get?.operationId).toBe('__proto__')
    expect(({} as Record<string, unknown>)['method']).toBeUndefined()
    expect(Object.getPrototypeOf(document.paths)).toBe(Object.prototype)
  })

  test('a "__proto__" field name inside a schema is rejected', () => {
    const body = JSON.parse('{"__proto__":["required","string"]}') as Record<string, never>

    const bad = options({
      routes: {
        a: {
          method: 'POST',
          path: '/a',
          request: { body },
          response: ok,
        },
      },
    })

    expect(catchError(() => new OpenAPI(bad)).message).toContain('invalid field name "__proto__"')
  })

  test.each(['/docs/../etc/passwd', '/a/%2e%2e/b', '/a/%2E%2E', '/a/..%2fb', '/a/\\b'])(
    'path traversal in a documented path is rejected: %s',
    (path) => {
      const bad = options({
        routes: {
          a: {
            method: 'GET',
            path,
            response: ok,
          },
        },
      })

      expect(catchError(() => new OpenAPI(bad))).toBeInstanceOf(OpenAPIValidationError)
    },
  )

  test('path traversal in documentation paths is rejected', () => {
    for (const docs of ['/docs/..', '/../docs', '/docs?x=1', 'docs']) {
      expect(catchError(() => new OpenAPI(options({ docs })))).toBeInstanceOf(
        OpenAPIValidationError,
      )
    }
  })

  test('static assets cannot be used for path traversal: only whitelisted files exist', async () => {
    const bob = new RiserBob()

    new OpenAPI(options()).setup(bob)

    const { base } = serve(bob)

    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const error = spyOn(console, 'error').mockImplementation(() => {})

    try {
      const attempts = [
        '/docs/assets/../../package.json',
        '/docs/assets/..%2f..%2fpackage.json',
        '/docs/assets/%2e%2e/%2e%2e/package.json',
        '/docs/assets/swagger-ui-bundle.js.map',
        '/docs/assets/index.html',
        '/docs/assets/',
      ]

      for (const path of attempts) {
        const response = await fetch(`${base}${path}`)

        expect([404, 400]).toContain(response.status)
        expect(await response.text()).not.toContain('"name"')
      }
    } finally {
      warn.mockRestore()
      error.mockRestore()
    }
  })

  test('unsafe HTML in descriptions and summaries is data only: JSON-encoded, never put in the HTML page', async () => {
    const payload = '<img src=x onerror=alert(1)><script>alert(1)</script>'

    const bob = new RiserBob()

    bob.spongGet('/a', (_spongReq, spongRes) => spongRes.json({}))

    new OpenAPI(
      options({
        info: {
          title: 'T',
          version: '1',
          description: payload,
        },
        routes: {
          a: {
            method: 'GET',
            path: '/a',
            summary: payload,
            description: payload,
            tags: [payload],
            response: {
              200: {
                description: payload,
              },
            },
          },
        },
      }),
    ).setup(bob)

    const { base } = serve(bob)

    const json = await fetch(`${base}/docs/json`)

    expect(json.headers.get('content-type')).toContain('application/json')
    expect(json.headers.get('x-content-type-options')).toBe('nosniff')

    expect(((await json.json()) as { info: { description: string } }).info.description).toBe(
      payload,
    )

    const html = await (await fetch(`${base}/docs`)).text()

    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert(1)')
  })

  test('the page title is HTML-escaped', async () => {
    const title = '</title><script>alert(1)</script>'

    const bob = new RiserBob()

    new OpenAPI(options({ swaggerUI: { title } })).setup(bob)

    const { base } = serve(bob)

    const html = await (await fetch(`${base}/docs`)).text()

    expect(html).toContain('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;')

    expect(html).not.toContain('<script>alert')
    expect(html.match(/<script/g)).toHaveLength(2)
  })

  test('escapeHtml and the generators never emit raw markup from their inputs', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )

    expect(renderHtml('/docs', '"><svg onload=alert(1)>')).not.toContain('<svg')

    expect(
      renderInitScript('/x"};alert(1);//', {
        title: 't',
        persistAuthorization: false,
        docExpansion: 'list',
      }),
    ).toContain('"/x\\"};alert(1);//"')
  })

  test('a documentation title / UI settings with control characters or bad values are rejected', () => {
    expect(catchError(() => new OpenAPI(options({ swaggerUI: { title: 'a\nb' } })))).toBeInstanceOf(
      OpenAPIValidationError,
    )

    expect(
      catchError(
        () =>
          new OpenAPI(
            options({
              swaggerUI: {
                docExpansion: 'x' as never,
              },
            }),
          ),
      ),
    ).toBeInstanceOf(OpenAPIValidationError)
  })

  test('a CSP forbids external scripts and framing on the documentation page', async () => {
    const bob = new RiserBob()

    new OpenAPI(options()).setup(bob)

    const { base } = serve(bob)

    const response = await fetch(`${base}/docs`)
    const csp = response.headers.get('content-security-policy') ?? ''

    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toMatch(/\*|unsafe-eval|https?:/)

    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  test('documentation path conflicts are refused instead of hijacking application routes', () => {
    const bob = new RiserBob()

    bob.spongGet('/docs/json', (_spongReq, spongRes) => spongRes.json({ app: true }))

    expect(catchError(() => new OpenAPI(options()).setup(bob)).message).toContain(
      'Documentation Path Conflict',
    )
  })

  test('the library does not modify the router: only the documented GET routes are added', () => {
    const bob = new RiserBob()

    bob.spongGet('/a', (_spongReq, spongRes) => spongRes.json({}))

    const before = bob.spongRoutes()

    new OpenAPI(options()).setup(bob)

    const added = bob.spongRoutes().slice(before.length)

    expect(bob.spongRoutes().slice(0, before.length)).toEqual([...before])

    expect(added.every((route) => route.method === 'GET' && route.path.startsWith('/docs'))).toBe(
      true,
    )
  })

  test('the route snapshot exposed by RiserBob is immutable, so the library cannot corrupt the router', () => {
    const bob = new RiserBob()

    bob.spongGet('/a', (_spongReq, spongRes) => spongRes.json({}))

    const routes = bob.spongRoutes() as unknown as Array<{ path: string }>

    expect(() => routes.push({ path: '/x' })).toThrow()

    expect(() => {
      const first = routes[0]
      if (first) first.path = '/hacked'
    }).toThrow()

    expect(bob.spongRoutes()).toEqual([
      {
        method: SpongMethod.GET,
        path: '/a',
      },
    ])
  })

  test('no environment variables or tokens leak into errors or documents', () => {
    process.env['OPENAPI_TEST_SECRET'] = 'super-secret-token-value'

    try {
      const bob = new RiserBob()

      const openapi = new OpenAPI(
        options({
          routes: {
            a: {
              method: 'GET',
              path: '/a',
              response: ok,
            },
          },
        }),
      )

      const failure = catchError(() => openapi.setup(bob))

      expect(failure.message).not.toContain('super-secret-token-value')

      bob.spongGet('/a', (_spongReq, spongRes) => spongRes.json({}))

      openapi.setup(bob)

      expect(JSON.stringify(openapi.getDocument())).not.toContain('super-secret-token-value')
    } finally {
      delete process.env['OPENAPI_TEST_SECRET']
    }
  })

  test('the library only talks about security schemes; it never issues or stores tokens', () => {
    const doc = new OpenAPI(
      options({
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        routes: {
          a: {
            method: 'GET',
            path: '/a',
            security: ['BearerAuth'],
            response: ok,
          },
        },
      }),
    ).generate(
      Object.assign(new RiserBob(), {}).spongGet('/a', (_spongReq, spongRes) => spongRes.json({})),
    )

    expect(doc.components?.securitySchemes['BearerAuth']).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
  })
})
