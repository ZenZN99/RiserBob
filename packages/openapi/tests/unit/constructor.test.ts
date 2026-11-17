import { describe, expect, test } from 'bun:test'
import { OpenAPI, OpenAPIValidationError, type OpenAPIOptions } from '../../src/index'
import { catchError, options } from '../helpers/app'

const route = {
  method: 'GET',
  path: '/users',
  response: { 200: { description: 'ok' } },
} as const

/** Builds deliberately malformed input; the cast is the point of these tests. */
function malformed(value: Record<string, unknown>): OpenAPIOptions {
  return value as unknown as OpenAPIOptions
}

function issuesOf(value: Record<string, unknown>): string {
  const error = catchError(() => new OpenAPI(malformed(value)))
  expect(error).toBeInstanceOf(OpenAPIValidationError)
  return error.message
}

describe('OpenAPI constructor', () => {
  test('accepts a valid configuration', () => {
    expect(() => new OpenAPI(options({ routes: { getUsers: { ...route } } }))).not.toThrow()
  })

  test('accepts empty routes', () => {
    expect(() => new OpenAPI(options())).not.toThrow()
  })

  test('rejects missing info', () => {
    expect(issuesOf({ routes: {} })).toContain('info: is required')
  })

  test('rejects missing title and version (both reported together)', () => {
    const message = issuesOf({ info: {}, routes: {} })
    expect(message).toContain('info.title')
    expect(message).toContain('info.version')
  })

  test('rejects missing routes', () => {
    expect(issuesOf({ info: { title: 'T', version: '1' } })).toContain('routes: is required')
  })

  test('rejects a non-object options argument', () => {
    expect(catchError(() => new OpenAPI(malformed(null as never)))).toBeInstanceOf(OpenAPIValidationError)
  })

  test('rejects an invalid route configuration and unknown properties (typos)', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: { a: 'nope', b: { ...route, summery: 'typo' } },
    })
    expect(message).toContain('routes.a: must be an object')
    expect(message).toContain('routes.b: unknown property "summery"')
  })

  test('rejects an invalid HTTP method, including OPTIONS (unreachable in RiserBob)', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: {
        a: { ...route, method: 'FETCH' },
        b: { ...route, path: '/b', method: 'OPTIONS' },
      },
    })
    expect(message).toContain('routes.a.method: must be one of')
    expect(message).toContain('routes.b.method: OPTIONS cannot be documented')
  })

  test.each([
    ['users', 'must start with "/"'],
    ['/users?x=1', 'must not contain'],
    ['/users/../admin', 'path traversal'],
    ['/users/%2e%2e', 'path traversal'],
    ['/users/:', 'invalid parameter segment'],
    ['/users/{id', 'invalid path segment'],
    ['/users/:id/:id', 'appears more than once'],
    ['/a b', 'must not contain'],
  ])('rejects invalid path %p', (path, reason) => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: { a: { ...route, path } },
    })
    expect(message).toContain('routes.a.path')
    expect(message).toContain(reason)
  })

  test.each(['99', '600', 'abc', '2xx', '200.5'])('rejects invalid response status %p', (status) => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: { a: { ...route, response: { [status]: { description: 'x' } } } },
    })
    expect(message).toContain(`routes.a.response.${status}`)
  })

  test('requires at least one response and a description for each', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: { a: { ...route, response: {} }, b: { ...route, path: '/b', response: { 200: {} } } },
    })
    expect(message).toContain('must document at least one status code')
    expect(message).toContain('routes.b.response.200.description')
  })

  test('rejects an invalid schema and names the field', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: {
        a: {
          ...route,
          method: 'POST',
          request: { body: { name: ['required', 'string', 'madeUpRule'] } },
        },
      },
    })
    expect(message).toContain('routes.a.request.body')
    expect(message).toContain('unknown rule "madeUpRule"')
  })

  test('rejects schemas the Validator itself would refuse (required + nullable)', () => {
    expect(
      issuesOf({
        info: { title: 'T', version: '1' },
        routes: { a: { ...route, response: { 200: { description: 'x', schema: { a: ['required', 'nullable', 'string'] } } } } },
      }),
    ).toContain('"required" and "nullable" cannot be combined')
  })

  test('rejects a body on GET and HEAD', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: { a: { ...route, request: { body: { a: ['required', 'string'] } } } },
    })
    expect(message).toContain('GET requests must not have a request body')
  })

  test('rejects path-parameter schema conflicts', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: {
        a: { ...route, path: '/users/:id', request: { params: { userId: ['required', 'string'] } } },
        b: { ...route, path: '/nullable/:id', request: { params: { id: ['nullable', 'string'] } } },
      },
    })
    expect(message).toContain('field "userId" is not a parameter of path "/users/:id"')
    expect(message).toContain('path parameter "id" cannot be nullable')
  })

  test('rejects two documented routes describing the same operation', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      routes: {
        a: { ...route, path: '/users/:id' },
        b: { ...route, path: '/users/{userId}/' },
      },
    })
    expect(message).toContain('routes.b: conflicts with routes.a')
  })

  test('accepts the same path with different methods', () => {
    expect(
      () =>
        new OpenAPI(
          options({
            routes: { a: { ...route }, b: { ...route, method: 'POST' } },
          }),
        ),
    ).not.toThrow()
  })

  test('rejects unknown security scheme references and invalid schemes', () => {
    const message = issuesOf({
      info: { title: 'T', version: '1' },
      securitySchemes: { Bad: { type: 'oauth2' }, Key: { type: 'apiKey', in: 'body', name: 'x' } },
      routes: { a: { ...route, security: ['Missing'] } },
    })
    expect(message).toContain('securitySchemes.Bad.type')
    expect(message).toContain('securitySchemes.Key.in')
    expect(message).toContain('unknown security scheme "Missing"')
  })

  test('validates documentation paths', () => {
    expect(issuesOf({ info: { title: 'T', version: '1' }, routes: {}, docs: '/docs/:id' })).toContain(
      'documentation paths cannot contain parameters',
    )
    expect(issuesOf({ info: { title: 'T', version: '1' }, routes: {}, docs: '/x', json: '/x' })).toContain(
      'must use different paths',
    )
    expect(issuesOf({ info: { title: 'T', version: '1' }, routes: {}, json: false })).toContain(
      'cannot be disabled while Swagger UI',
    )
  })

  test('rejects javascript: URLs in info (rendered as links by Swagger UI)', () => {
    const message = issuesOf({
      info: {
        title: 'T',
        version: '1',
        termsOfService: 'javascript:alert(1)',
        contact: { url: 'javascript:alert(1)', email: 'nope' },
        license: { name: 'MIT', url: 'data:text/html,x' },
      },
      routes: {},
    })
    expect(message).toContain('info.termsOfService')
    expect(message).toContain('info.contact.url')
    expect(message).toContain('info.contact.email')
    expect(message).toContain('info.license.url')
  })

  test('is not affected by later mutation of the original options object', () => {
    const original = options({ routes: { getUsers: { ...route } } })
    const openapi = new OpenAPI(original)
    original.info.title = 'Hacked'
    ;(original.routes['getUsers'] as { path: string }).path = '/hacked'

    const app = new (class {
      spongGet(): void {}
      spongRoutes() {
        return [{ method: 'GET', path: '/users' }] as const
      }
    })()
    const doc = openapi.generate(app as never)
    expect(doc.info.title).toBe('Test API')
    expect(Object.keys(doc.paths)).toEqual(['/users'])
  })
})
