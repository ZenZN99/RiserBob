import { describe, expect, test } from 'bun:test'
import { OpenAPI, OpenAPIValidationError, type OpenAPIRoute } from '../../src/index'
import { catchError, createApp, options } from '../helpers/app'

const doc = (overrides: Partial<OpenAPIRoute> & Pick<OpenAPIRoute, 'method' | 'path'>): OpenAPIRoute => ({
  response: { 200: { description: 'ok' } },
  ...overrides,
})

function validate(routes: Record<string, OpenAPIRoute>, app = createApp([])): string[] {
  const openapi = new OpenAPI(options({ routes }))
  return Object.keys(openapi.generate(app).paths)
}

function failure(routes: Record<string, OpenAPIRoute>, app = createApp([])): OpenAPIValidationError {
  const openapi = new OpenAPI(options({ routes }))
  const error = catchError(() => openapi.generate(app))
  expect(error).toBeInstanceOf(OpenAPIValidationError)
  return error as OpenAPIValidationError
}

describe('Strict route validation', () => {
  test('registered GET route passes', () => {
    expect(validate({ getUsers: doc({ method: 'GET', path: '/users' }) }, createApp([['GET', '/users']]))).toEqual([
      '/users',
    ])
  })

  test('registered POST route passes', () => {
    expect(validate({ createUser: doc({ method: 'POST', path: '/users' }) }, createApp([['POST', '/users']]))).toEqual([
      '/users',
    ])
  })

  test('missing required route fails with key, method and path', () => {
    const error = failure({ getUsers: doc({ method: 'GET', path: '/users' }) })
    expect(error.message).toBe(
      [
        '[RiserBob OpenAPI] Strict Validation Failed',
        '',
        'Missing registered route:',
        '',
        'Documentation Key: getUsers',
        'Method: GET',
        'Path: /users',
        '',
        'The documented endpoint was not registered in RiserBob.',
      ].join('\n'),
    )
  })

  test('isRequired defaults to true', () => {
    expect(failure({ a: doc({ method: 'GET', path: '/a' }) }).issues).toHaveLength(1)
  })

  test('optional missing route does not fail and is excluded from the document', () => {
    const paths = validate(
      {
        present: doc({ method: 'GET', path: '/present', isRequired: false }),
        absent: doc({ method: 'GET', path: '/absent', isRequired: false }),
      },
      createApp([['GET', '/present']]),
    )
    expect(paths).toEqual(['/present'])
  })

  test('wrong HTTP method fails (a path alone is not enough) and hints at the registered method', () => {
    const error = failure({ getUsers: doc({ method: 'GET', path: '/users' }) }, createApp([['POST', '/users']]))
    expect(error.message).toContain('Documentation Key: getUsers')
    expect(error.message).toContain('Hint: this path is registered with: POST')
  })

  test('wrong path fails', () => {
    expect(
      failure({ getUsers: doc({ method: 'GET', path: '/users' }) }, createApp([['GET', '/people']])).issues,
    ).toHaveLength(1)
  })

  test('optional route with the wrong method is excluded, not documented', () => {
    expect(
      validate({ a: doc({ method: 'GET', path: '/users', isRequired: false }) }, createApp([['POST', '/users']])),
    ).toEqual([])
  })

  test('dynamic routes: RiserBob ":id" matches OpenAPI "{id}" and ":id" in the config', () => {
    const app = createApp([['GET', '/users/:id']])
    expect(validate({ a: doc({ method: 'GET', path: '/users/{id}' }) }, app)).toEqual(['/users/{id}'])
    expect(validate({ a: doc({ method: 'GET', path: '/users/:id' }) }, app)).toEqual(['/users/{id}'])
  })

  test('different parameter names are NOT equal and the hint says so', () => {
    const error = failure(
      { a: doc({ method: 'GET', path: '/users/{userId}' }) },
      createApp([['GET', '/users/:id']]),
    )
    expect(error.message).toContain('Path: /users/{userId}')
    expect(error.message).toContain('parameter names must match exactly; RiserBob registered GET /users/:id')
  })

  test('a static path does not match a dynamic registration (and vice versa)', () => {
    expect(failure({ a: doc({ method: 'GET', path: '/users/me' }) }, createApp([['GET', '/users/:id']])).issues).toHaveLength(1)
    expect(failure({ a: doc({ method: 'GET', path: '/users/:id' }) }, createApp([['GET', '/users/me']])).issues).toHaveLength(1)
  })

  test('trailing slashes are normalized like the RiserBob router', () => {
    const app = createApp([['GET', '/users/']])
    expect(validate({ a: doc({ method: 'GET', path: '/users' }) }, app)).toEqual(['/users'])
    expect(validate({ a: doc({ method: 'GET', path: '/users/' }) }, createApp([['GET', '/users']]))).toEqual(['/users'])
  })

  test('paths are case-sensitive, like the router', () => {
    expect(failure({ a: doc({ method: 'GET', path: '/Users' }) }, createApp([['GET', '/users']])).issues).toHaveLength(1)
  })

  test('routes registered through spongGroup are discovered', () => {
    const app = createApp([])
    app.spongGroup('/api', (group) => {
      group.spongGet('/users/:id', () => new Response('ok'))
    })
    expect(validate({ a: doc({ method: 'GET', path: '/api/users/{id}' }) }, app)).toEqual(['/api/users/{id}'])
  })

  test('collects every error instead of stopping at the first', () => {
    const error = failure(
      {
        one: doc({ method: 'GET', path: '/one' }),
        two: doc({ method: 'POST', path: '/two' }),
        three: doc({ method: 'DELETE', path: '/three/:id' }),
        fine: doc({ method: 'GET', path: '/fine' }),
      },
      createApp([['GET', '/fine']]),
    )
    expect(error.issues).toHaveLength(3)
    expect(error.message).toContain('Missing registered routes (3):')
    for (const key of ['one', 'two', 'three']) expect(error.message).toContain(`Documentation Key: ${key}`)
    expect(error.message).not.toContain('Documentation Key: fine')
    expect(error.message).toContain('The documented endpoints were not registered in RiserBob.')
  })

  test('registered but undocumented routes are fine and not documented', () => {
    expect(validate({}, createApp([['GET', '/secret']]))).toEqual([])
  })

  test('routes registered after generate() are not part of an earlier validation', () => {
    const app = createApp([])
    const openapi = new OpenAPI(options({ routes: { a: doc({ method: 'GET', path: '/late' }) } }))
    expect(catchError(() => openapi.generate(app))).toBeInstanceOf(OpenAPIValidationError)
    app.spongGet('/late', () => new Response('ok'))
    expect(Object.keys(openapi.generate(app).paths)).toEqual(['/late'])
  })

  test('detects documentation paths that collide with application routes', () => {
    const openapi = new OpenAPI(options())
    expect(
      catchError(() => openapi.generate(createApp([['GET', '/docs']]))).message,
    ).toContain('collides with the registered route GET /docs')
    // a dynamic route would be silently taken over by the (static) documentation route
    expect(
      catchError(() => openapi.generate(createApp([['GET', '/:slug']]))).message,
    ).toContain('collides with the registered route GET /:slug')
    // other methods on the same path do not collide
    expect(() => openapi.generate(createApp([['POST', '/docs']]))).not.toThrow()
  })

  test('can disable the documentation routes to avoid a collision', () => {
    const openapi = new OpenAPI(options({ docs: false, json: false }))
    expect(() => openapi.generate(createApp([['GET', '/docs'], ['GET', '/docs/json']]))).not.toThrow()
  })
})
