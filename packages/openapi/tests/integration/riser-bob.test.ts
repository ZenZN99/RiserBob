import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import {
  RiserBob,
  Validator,
  defineSchema,
  rules,
  type SpongMiddleware,
  type SpongRequest,
} from 'riser-bob'
import {
  OpenAPI,
  OpenAPIValidationError,
  type OpenAPIDocument,
  type OpenAPIOptions,
} from '../../src/index.js'
import { catchError, options } from '../helpers/app.js'

type Running = {
  server: ReturnType<RiserBob['spongListen']>
  base: string
}

const running: Running[] = []

let warn: ReturnType<typeof spyOn>
let error: ReturnType<typeof spyOn>

beforeEach(() => {
  warn = spyOn(console, 'warn').mockImplementation(() => {})
  error = spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const { server } of running.splice(0)) {
    server.stop(true)
  }

  warn.mockRestore()
  error.mockRestore()
})

function listen(app: RiserBob): Running {
  const server = app.spongListen(0)

  const instance: Running = {
    server,
    base: `http://127.0.0.1:${server.port}`,
  }

  running.push(instance)

  return instance
}

const CreateUser = defineSchema({
  name: rules(['required', 'string', 'minLength:2']),
  email: rules(['required', 'email']),
})

const routes: OpenAPIOptions['routes'] = {
  getUsers: {
    method: 'GET',
    path: '/users',
    summary: 'Get all users',
    tags: ['Users'],
    response: { 200: { description: 'Users retrieved successfully' } },
  },
  createUser: {
    method: 'POST',
    path: '/users',
    summary: 'Create a new user',
    request: { body: CreateUser },
    response: { 201: { description: 'Created' }, 422: { description: 'Invalid body' } },
  },
  getUser: {
    method: 'GET',
    path: '/users/:id',
    request: { params: defineSchema({ id: rules(['required', 'number']) }) },
    response: { 200: { description: 'Found' }, 404: { description: 'Not found' } },
  },
  legacy: {
    method: 'GET',
    path: '/legacy',
    isRequired: false,
    response: { 200: { description: 'Only documented when registered' } },
  },
}

function createApp(): RiserBob {
  const bob = new RiserBob()
  bob.spongGet('/users', (_spongRes, spongRes) => spongRes.json({ users: [] }))
  bob.spongPost('/users', async (spongReq, spongRes) => {
    const result = Validator.validate(await spongReq.json<Record<string, unknown>>(), CreateUser)
    return result.valid
      ? spongRes.status(201).json({ ok: true })
      : spongRes.status(422).json({ errors: result.errors })
  })
  bob.spongGet('/users/:id', (spongReq, spongRes) => spongRes.json({ id: spongReq.params.id }))
  return bob
}

function docs(bob: RiserBob, extra: Partial<OpenAPIOptions> = {}): OpenAPI {
  const openapi = new OpenAPI(options({ routes, ...extra }))
  openapi.setup(bob)
  return openapi
}

describe('integration with a real RiserBob server', () => {
  test('serves valid OpenAPI 3.1 JSON at /docs/json', async () => {
    const app = createApp()
    const openapi = docs(app)
    const { base } = listen(app)

    const response = await fetch(`${base}/docs/json`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')

    const document = (await response.json()) as OpenAPIDocument
    expect(document.openapi).toBe('3.1.0')
    expect(document.info).toEqual({ title: 'Test API', version: '1.0.0' })
    expect(Object.keys(document.paths)).toEqual(['/users', '/users/{id}'])
    expect(Object.keys(document.paths['/users'] ?? {})).toEqual(['get', 'post'])
    expect(document.paths['/users/{id}']?.get?.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'number' } },
    ])
    expect(document).toEqual(openapi.getDocument())
  })

  test('the unregistered optional route is not in the served document', async () => {
    const app = createApp()
    docs(app)
    const { base } = listen(app)

    const document = (await (await fetch(`${base}/docs/json`)).json()) as OpenAPIDocument
    expect(Object.keys(document.paths)).not.toContain('/legacy')
  })

  test('an optional route that IS registered is documented', async () => {
    const app = createApp()
    app.spongGet('/legacy', (_spongReq, spongRes) => spongRes.json({}))
    docs(app)
    const { base } = listen(app)

    const document = (await (await fetch(`${base}/docs/json`)).json()) as OpenAPIDocument
    expect(Object.keys(document.paths)).toContain('/legacy')
  })

  test('the application routes keep working after setup', async () => {
    const app = createApp()
    docs(app)
    const { base } = listen(app)

    expect(await (await fetch(`${base}/users`)).json()).toEqual({ users: [] })
    expect(await (await fetch(`${base}/users/42`)).json()).toEqual({ id: '42' })
    const created = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'bob@example.com' }),
    })
    expect(created.status).toBe(201)
    const invalid = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'B' }),
    })
    expect(invalid.status).toBe(422)
  })

  test('the documented request body matches what the Validator enforces (same schema, written once)', async () => {
    const app = createApp()
    const openapi = docs(app)
    const body =
      openapi.getDocument().paths['/users']?.post?.requestBody?.content['application/json']?.schema
    expect(body).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
      },
      required: ['name', 'email'],
    })
  })

  test('serves Swagger UI at /docs from local files, with a strict CSP and no external sources', async () => {
    const app = createApp()
    docs(app)
    const { base } = listen(app)

    const page = await fetch(`${base}/docs`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8')
    const csp = page.headers.get('content-security-policy') ?? ''
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('http')

    const html = await page.text()
    expect(html).toContain('<title>Test API</title>')
    expect(html).toContain('/docs/assets/swagger-ui-bundle.js')
    expect(html).not.toMatch(/https?:\/\//)
    expect(html).not.toMatch(/<script>/) // no inline scripts

    const bundle = await fetch(`${base}/docs/assets/swagger-ui-bundle.js`)
    expect(bundle.status).toBe(200)
    expect(bundle.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect((await bundle.text()).length).toBeGreaterThan(100_000)

    const css = await fetch(`${base}/docs/assets/swagger-ui.css`)
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8')

    const init = await (await fetch(`${base}/docs/assets/init.js`)).text()
    expect(init).toContain('"/docs/json"')
    expect(init).toContain('validatorUrl: null') // never call an external validator service
  })

  test('/docs/ with a trailing slash also works', async () => {
    const app = createApp()
    docs(app)
    const { base } = listen(app)
    expect((await fetch(`${base}/docs/`)).status).toBe(200)
  })

  test('documentation paths are configurable and can be disabled', async () => {
    const app = createApp()
    docs(app, { docs: '/api-docs', json: '/api-docs/json' })
    const { base } = listen(app)

    expect((await fetch(`${base}/api-docs`)).status).toBe(200)
    expect((await fetch(`${base}/api-docs/json`)).status).toBe(200)
    expect((await fetch(`${base}/docs`)).status).toBe(404)
    expect(await (await fetch(`${base}/api-docs/assets/init.js`)).text()).toContain(
      '"/api-docs/json"',
    )

    const jsonOnly = createApp()
    docs(jsonOnly, { docs: false })
    const second = listen(jsonOnly)
    expect((await fetch(`${second.base}/docs/json`)).status).toBe(200)
    expect((await fetch(`${second.base}/docs`)).status).toBe(404)
  })

  test('setup registers exactly the documentation routes, once', () => {
    const app = createApp()
    const before = app.spongRoutes().length
    const openapi = docs(app)
    const registered = app.spongRoutes().map((r) => `${r.method} ${r.path}`)

    expect(registered.slice(before)).toEqual([
      'GET /docs/json',
      'GET /docs',
      'GET /docs/assets/init.js',
      'GET /docs/assets/swagger-ui.css',
      'GET /docs/assets/swagger-ui-bundle.js',
    ])

    openapi.setup(app) // repeated setup with the same app: no-op, no duplicates, no throw
    openapi.setup(app)
    expect(app.spongRoutes()).toHaveLength(before + 5)
  })

  test('setup with a different application is rejected', () => {
    const openapi = docs(createApp())
    expect(catchError(() => openapi.setup(createApp())).message).toContain(
      'already set up with another application',
    )
  })

  test('strict validation at setup throws, lists everything, and registers nothing', () => {
    const app = new RiserBob()
    app.spongGet('/users', (_spongReq, spongRes) => spongRes.json({}))
    const before = app.spongRoutes().length

    const openapi = new OpenAPI(options({ routes }))
    const failure = catchError(() => openapi.setup(app))

    expect(failure).toBeInstanceOf(OpenAPIValidationError)
    expect(failure.message).toContain('Missing registered routes (2):')
    expect(failure.message).toContain('Documentation Key: createUser')
    expect(failure.message).toContain('Documentation Key: getUser')
    expect(failure.message).not.toContain('Documentation Key: getUsers')
    expect(failure.message).not.toContain('Documentation Key: legacy')
    expect(app.spongRoutes()).toHaveLength(before)
    expect(() => openapi.getDocument()).toThrow('only available after setup')
  })

  test('a failed setup can be retried once the routes exist', () => {
    const app = new RiserBob()
    const openapi = new OpenAPI(
      options({
        routes: { a: { method: 'GET', path: '/a', response: { 200: { description: 'ok' } } } },
      }),
    )

    expect(() => openapi.setup(app)).toThrow(OpenAPIValidationError)
    app.spongGet('/a', (_spongReq, spongRes) => spongRes.json({}))
    expect(() => openapi.setup(app)).not.toThrow()
  })

  test('a documentation path that collides with an application route is refused', () => {
    const app = createApp()
    app.spongGet('/docs', (_spongReq, spongRes) => spongRes.json({ mine: true }))
    const failure = catchError(() => new OpenAPI(options({ routes })).setup(app))
    expect(failure.message).toContain('Documentation Path Conflict')
    expect(failure.message).toContain('GET /docs')
  })

  test('RiserBob versions without spongRoutes() get a clear error', () => {
    const legacyApp = { spongGet: () => legacyApp }
    const failure = catchError(() => new OpenAPI(options()).setup(legacyApp as never))
    expect(failure.message).toContain('requires riser-bob >= 1.3.0')
  })

  test('non-RiserBob objects are rejected', () => {
    for (const value of [undefined, null, {}, 'app']) {
      expect(() => new OpenAPI(options()).setup(value as never)).toThrow('RiserBob application')
    }
  })

  test('getDocument() returns a copy: mutating it cannot corrupt the served document', async () => {
    const app = createApp()
    const openapi = docs(app)
    const copy = openapi.getDocument()
    copy.info.title = 'Hacked'
    delete copy.paths['/users']

    expect(openapi.getDocument().info.title).toBe('Test API')
    expect(Object.keys(openapi.getDocument().paths)).toContain('/users')

    const { base } = listen(app)
    const served = (await (await fetch(`${base}/docs/json`)).json()) as OpenAPIDocument
    expect(served.info.title).toBe('Test API')
  })

  test('the document is generated once: requests do not regenerate it', async () => {
    const app = createApp()
    const openapi = docs(app)
    const { base } = listen(app)
    const spy = spyOn(openapi, 'generate')

    for (let i = 0; i < 3; i++) await (await fetch(`${base}/docs/json`)).text()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('access control stays with RiserBob', () => {
  const guard: SpongMiddleware<SpongRequest> = (spongReq, _spongRes, next) =>
    spongReq.headers.get('x-docs-key') === 'secret'
      ? next()
      : new Response('Unauthorized', { status: 401 })

  test('options.middlewares protects the UI, JSON and assets, and nothing else', async () => {
    const app = createApp()
    docs(app, { middlewares: [guard] })
    const { base } = listen(app)

    for (const path of [
      '/docs',
      '/docs/json',
      '/docs/assets/init.js',
      '/docs/assets/swagger-ui-bundle.js',
    ]) {
      expect((await fetch(`${base}${path}`)).status).toBe(401)
      expect((await fetch(`${base}${path}`, { headers: { 'x-docs-key': 'secret' } })).status).toBe(
        200,
      )
    }
    expect((await fetch(`${base}/users`)).status).toBe(200)
  })

  test('global middleware added with spongUse before setup also applies to the documentation', async () => {
    const app = new RiserBob()
    app.spongUse(guard)
    app.spongGet('/users', (_spongReq, spongRes) => spongRes.json({}))
    new OpenAPI(
      options({
        routes: {
          getUsers: { method: 'GET', path: '/users', response: { 200: { description: 'ok' } } },
        },
      }),
    ).setup(app)
    const { base } = listen(app)

    expect((await fetch(`${base}/docs/json`)).status).toBe(401)
    expect((await fetch(`${base}/docs/json`, { headers: { 'x-docs-key': 'secret' } })).status).toBe(
      200,
    )
  })
})
