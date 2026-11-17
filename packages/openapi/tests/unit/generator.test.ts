import { describe, expect, test } from 'bun:test'
import { defineSchema, rules } from 'riser-bob'
import { OpenAPI, type OpenAPIDocument, type OpenAPIOptions, type OpenAPIRoute } from '../../src/index'
import { createApp, options } from '../helpers/app'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

function generate(routes: Record<string, OpenAPIRoute>, extra: Partial<OpenAPIOptions> = {}): OpenAPIDocument {
  const app = createApp(Object.values(routes).map((r) => [r.method as Method, r.path] as const))
  return new OpenAPI(options({ routes, ...extra })).generate(app)
}

const ok = { 200: { description: 'ok' } }

describe('Generator', () => {
  test('declares OpenAPI 3.1.0 and copies the info object', () => {
    const doc = generate({}, {
      info: {
        title: 'HireHub API',
        version: '1.0.0',
        description: 'HireHub REST API Documentation',
        contact: { name: 'Team', email: 'team@example.com', url: 'https://example.com' },
        license: { name: 'MIT', url: 'https://example.com/license' },
        termsOfService: 'https://example.com/terms',
      },
    })
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info).toEqual({
      title: 'HireHub API',
      version: '1.0.0',
      description: 'HireHub REST API Documentation',
      contact: { name: 'Team', email: 'team@example.com', url: 'https://example.com' },
      license: { name: 'MIT', url: 'https://example.com/license' },
      termsOfService: 'https://example.com/terms',
    })
    expect(doc.paths).toEqual({})
  })

  test('GET endpoint matches the documented shape (and documentation keys never become paths)', () => {
    const doc = generate({
      getUsers: {
        method: 'GET',
        path: '/users',
        summary: 'Get all users',
        description: 'Returns all registered users',
        tags: ['Users'],
        response: { 200: { description: 'Users retrieved successfully' } },
      },
    })

    expect(doc.paths).toEqual({
      '/users': {
        get: {
          summary: 'Get all users',
          description: 'Returns all registered users',
          tags: ['Users'],
          operationId: 'getUsers',
          responses: { '200': { description: 'Users retrieved successfully' } },
        },
      },
    })
    expect(Object.keys(doc.paths)).not.toContain('getUsers')
  })

  test('POST endpoint sits beside GET on the same path; methods are lowercase', () => {
    const doc = generate({
      getUsers: { method: 'GET', path: '/users', response: ok },
      createUser: { method: 'POST', path: '/users', response: { 201: { description: 'created' } } },
    })
    expect(Object.keys(doc.paths['/users'] ?? {})).toEqual(['get', 'post'])
    expect(doc.paths['/users']?.post?.responses).toEqual({ '201': { description: 'created' } })
  })

  test('all HTTP methods that RiserBob can serve are supported', () => {
    const methods: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']
    const routes = Object.fromEntries(
      methods.map((method) => [`op${method}`, { method, path: '/thing', response: ok } satisfies OpenAPIRoute]),
    )
    expect(Object.keys(generate(routes).paths['/thing'] ?? {})).toEqual(methods.map((m) => m.toLowerCase()))
  })

  test('multiple status codes, sorted ascending', () => {
    const doc = generate({
      a: {
        method: 'GET',
        path: '/a',
        response: {
          500: { description: 'boom' },
          200: { description: 'fine', schema: defineSchema({ id: rules(['required', 'string']) }) },
          404: { description: 'missing' },
        },
      },
    })
    const responses = doc.paths['/a']?.get?.responses ?? {}
    expect(Object.keys(responses)).toEqual(['200', '404', '500'])
    expect(responses['404']).toEqual({ description: 'missing' })
  })

  test('response schemas use application/json by default and honour contentType', () => {
    const schema = defineSchema({ id: rules(['required', 'string']) })
    const doc = generate({
      a: {
        method: 'GET',
        path: '/a',
        response: {
          200: { description: 'json', schema },
          201: { description: 'xml', schema, contentType: 'application/xml' },
        },
      },
    })
    const responses = doc.paths['/a']?.get?.responses ?? {}
    expect(Object.keys(responses['200']?.content ?? {})).toEqual(['application/json'])
    expect(Object.keys(responses['201']?.content ?? {})).toEqual(['application/xml'])
    expect(responses['200']?.content?.['application/json']?.schema).toEqual({
      type: 'object',
      properties: { id: { type: 'string', minLength: 1 } },
      required: ['id'],
    })
  })

  test('responses without a schema declare no content (JSON is never assumed)', () => {
    expect(generate({ a: { method: 'GET', path: '/a', response: ok } }).paths['/a']?.get?.responses['200']).toEqual({
      description: 'ok',
    })
  })

  test('request body: required fields, JSON by default', () => {
    const doc = generate({
      createUser: {
        method: 'POST',
        path: '/users',
        request: {
          body: defineSchema({
            name: rules(['required', 'string']),
            email: rules(['required', 'email']),
            age: rules(['nullable', 'number', 'min:18']),
          }),
        },
        response: ok,
      },
    })
    expect(doc.paths['/users']?.post?.requestBody).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1 },
              email: { type: 'string', format: 'email' },
              age: { type: ['number', 'null'], minimum: 18 },
            },
            required: ['name', 'email'],
          },
        },
      },
    })
  })

  test('request body with only optional fields is not required; form content types are supported', () => {
    const body = defineSchema({ note: rules(['nullable', 'string']) })
    const doc = generate({
      a: { method: 'POST', path: '/a', request: { body, contentType: 'application/x-www-form-urlencoded' }, response: ok },
      b: { method: 'POST', path: '/b', request: { body, contentType: 'multipart/form-data' }, response: ok },
    })
    const a = doc.paths['/a']?.post?.requestBody
    expect(a?.required).toBe(false)
    expect(Object.keys(a?.content ?? {})).toEqual(['application/x-www-form-urlencoded'])
    expect(Object.keys(doc.paths['/b']?.post?.requestBody?.content ?? {})).toEqual(['multipart/form-data'])
  })

  test('query and header parameters keep required / optional exactly', () => {
    const doc = generate({
      list: {
        method: 'GET',
        path: '/users',
        request: {
          query: defineSchema({
            page: rules(['nullable', 'number', 'min:1']),
            search: rules(['required', 'string']),
          }),
          headers: defineSchema({ 'x-request-id': rules(['required', 'string']) }),
        },
        response: ok,
      },
    })
    expect(doc.paths['/users']?.get?.parameters).toEqual([
      { name: 'page', in: 'query', required: false, schema: { type: ['number', 'null'], minimum: 1 } },
      { name: 'search', in: 'query', required: true, schema: { type: 'string', minLength: 1 } },
      { name: 'x-request-id', in: 'header', required: true, schema: { type: 'string', minLength: 1 } },
    ])
  })

  test('path parameters are extracted from the path: required, string by default, never duplicated', () => {
    const doc = generate({
      getUser: { method: 'GET', path: '/users/:id/posts/:postId', response: ok },
    })
    expect(Object.keys(doc.paths)).toEqual(['/users/{id}/posts/{postId}'])
    expect(doc.paths['/users/{id}/posts/{postId}']?.get?.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'postId', in: 'path', required: true, schema: { type: 'string' } },
    ])
  })

  test('a params schema refines the type; the parameter is still emitted once and as required', () => {
    const doc = generate({
      getUser: {
        method: 'GET',
        path: '/users/:id',
        request: { params: defineSchema({ id: rules(['required', 'number', 'min:1']) }) },
        response: ok,
      },
    })
    expect(doc.paths['/users/{id}']?.get?.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'number', minimum: 1 } },
    ])
  })

  test('path, query and header parameters are listed in that order', () => {
    const params = generate({
      a: {
        method: 'GET',
        path: '/users/:id',
        request: {
          headers: defineSchema({ 'x-tenant': rules(['required', 'string']) }),
          query: defineSchema({ q: rules(['nullable', 'string']) }),
        },
        response: ok,
      },
    }).paths['/users/{id}']?.get?.parameters?.map((p) => p.in)
    expect(params).toEqual(['path', 'query', 'header'])
  })

  test('security schemes are centralized and referenced per route', () => {
    const doc = generate(
      {
        secured: { method: 'GET', path: '/me', security: ['BearerAuth', 'ApiKeyAuth'], response: ok },
        open: { method: 'GET', path: '/health', response: ok },
      },
      {
        securitySchemes: {
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
          CookieAuth: { type: 'apiKey', in: 'cookie', name: 'session' },
        },
      },
    )
    expect(doc.components).toEqual({
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        CookieAuth: { type: 'apiKey', in: 'cookie', name: 'session' },
      },
    })
    expect(doc.paths['/me']?.get?.security).toEqual([{ BearerAuth: [] }, { ApiKeyAuth: [] }])
    expect(doc.paths['/health']?.get?.security).toBeUndefined()
  })

  test('no components when no security schemes are configured', () => {
    expect(generate({}).components).toBeUndefined()
  })

  test('deprecated routes', () => {
    const doc = generate({
      old: { method: 'GET', path: '/old', deprecated: true, response: ok },
      current: { method: 'GET', path: '/current', response: ok },
    })
    expect(doc.paths['/old']?.get?.deprecated).toBe(true)
    expect(doc.paths['/current']?.get).not.toHaveProperty('deprecated')
  })

  test('servers are emitted when configured', () => {
    expect(generate({}, { servers: [{ url: 'https://api.example.com', description: 'Prod' }, { url: '/v1' }] }).servers).toEqual([
      { url: 'https://api.example.com', description: 'Prod' },
      { url: '/v1' },
    ])
  })

  test('output is deterministic and survives a JSON round trip without loss', () => {
    const routes: Record<string, OpenAPIRoute> = {
      a: {
        method: 'POST',
        path: '/users/:id',
        request: { body: defineSchema({ name: rules(['required', 'string']) }) },
        response: { 200: { description: 'ok' }, 400: { description: 'bad' } },
      },
    }
    const first = generate(routes)
    expect(JSON.stringify(generate(routes))).toBe(JSON.stringify(first))
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
  })

  test('two operations can never overwrite each other (conflicts are rejected up front)', () => {
    expect(
      () =>
        new OpenAPI(
          options({
            routes: {
              a: { method: 'GET', path: '/x/:id', response: ok },
              b: { method: 'GET', path: '/x/{other}', response: ok },
            },
          }),
        ),
    ).toThrow(/conflicts with routes\.a/)
  })
})
