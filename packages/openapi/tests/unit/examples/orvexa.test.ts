import { beforeAll, describe, expect, test } from 'bun:test'


const BASE_URL = 'http://localhost:4000'
const ACCESS_TOKEN = 'demo-access-token'
const REFRESH_TOKEN = 'demo-refresh-token'
const RESET_TOKEN = 'demo-reset-token'
const API_KEY = 'demo-key'

type Json = Record<string, unknown>

interface ListBody {
  data: Json[]
  page: number
  limit: number
  total: number
}

interface OpenApiDocument {
  info: { title: string; version: string }
  paths: Record<string, Record<string, unknown>>
}

interface RequestOptions {
  body?: unknown
  rawBody?: string
  auth?: boolean
  headers?: Record<string, string>
}

async function api(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers }
  if (options.auth) headers.Authorization = `Bearer ${ACCESS_TOKEN}`

  let body: string | undefined
  if (options.rawBody !== undefined) {
    body = options.rawBody
    headers['Content-Type'] = 'application/json'
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    headers['Content-Type'] = 'application/json'
  }

  return fetch(`${BASE_URL}${path}`, { method, headers, body })
}

async function readBody<T = Json>(res: Response): Promise<T> {
  return (await res.json()) as T
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/docs/json`)
      if (res.status === 200) return
    } catch {
      // Server is not accepting connections yet.
    }
    await Bun.sleep(100)
  }
  throw new Error('The Orvexa example server did not start on port 4000.')
}

beforeAll(async () => {
  await waitForServer()
})

// Documentation

describe('OpenAPI documentation', () => {
  test('GET /docs/json returns the OpenAPI document', async () => {
    const res = await api('GET', '/docs/json')
    expect(res.status).toBe(200)

    const doc = await readBody<OpenApiDocument>(res)
    expect(doc.info.title).toBe('Orvexa Digital Services Platform API')
    expect(doc.info.version).toBe('1.0.0')
  })

  test('the document lists the documented routes', async () => {
    const doc = await readBody<OpenApiDocument>(await api('GET', '/docs/json'))
    const paths = Object.keys(doc.paths)

    expect(paths.length).toBeGreaterThan(0)
    expect(paths.some((path) => path.includes('/auth/login'))).toBe(true)
    expect(paths.some((path) => path.includes('/services'))).toBe(true)
    expect(paths.some((path) => path.includes('/wallet'))).toBe(true)
  })

  test('GET /docs serves the Swagger UI page', async () => {
    const res = await api('GET', '/docs')
    expect(res.status).toBe(200)

    const html = await res.text()
    expect(html).toContain('Orvexa API Explorer')
  })
})

// Authentication

describe('Authentication', () => {
  test('POST /auth/register creates an account', async () => {
    const res = await api('POST', '/auth/register', {
      body: { name: 'New User', email: 'new@orvexa.example', password: 'Password123' },
    })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.name).toBe('New User')
    expect(body.email).toBe('new@orvexa.example')
    expect(typeof body.id).toBe('number')
  })

  test('POST /auth/register returns 409 for the reserved email', async () => {
    const res = await api('POST', '/auth/register', {
      body: { name: 'Taken', email: 'taken@orvexa.example', password: 'Password123' },
    })
    expect(res.status).toBe(409)
  })

  test('POST /auth/register returns 400 for a short password', async () => {
    const res = await api('POST', '/auth/register', {
      body: { name: 'New User', email: 'new@orvexa.example', password: 'short' },
    })
    expect(res.status).toBe(400)
  })

  test('POST /auth/register returns 400 for an invalid email', async () => {
    const res = await api('POST', '/auth/register', {
      body: { name: 'New User', email: 'not-an-email', password: 'Password123' },
    })
    expect(res.status).toBe(400)
  })

  test('POST /auth/register returns 400 for a body that is not JSON', async () => {
    const res = await api('POST', '/auth/register', { rawBody: 'not json' })
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('The request body must be a valid JSON object.')
  })

  test('POST /auth/login succeeds with the demo credentials', async () => {
    const res = await api('POST', '/auth/login', {
      body: { email: 'demo@orvexa.example', password: 'Password123' },
    })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.accessToken).toBe(ACCESS_TOKEN)
    expect(body.refreshToken).toBe(REFRESH_TOKEN)
    expect(body.email).toBe('demo@orvexa.example')
  })

  test('POST /auth/login sets the access_token cookie', async () => {
    const res = await api('POST', '/auth/login', {
      body: { email: 'demo@orvexa.example', password: 'Password123' },
    })
    const cookie = res.headers.get('set-cookie') ?? ''

    expect(cookie).toContain(`access_token=${ACCESS_TOKEN}`)
    expect(cookie).toContain('HttpOnly')
  })

  test('POST /auth/login is case-insensitive for the email', async () => {
    const res = await api('POST', '/auth/login', {
      body: { email: 'DEMO@orvexa.example', password: 'Password123' },
    })
    expect(res.status).toBe(200)
  })

  test('POST /auth/login returns 401 for a wrong password', async () => {
    const res = await api('POST', '/auth/login', {
      body: { email: 'demo@orvexa.example', password: 'WrongPassword' },
    })
    expect(res.status).toBe(401)
  })

  test('POST /auth/login returns 401 for an unknown email', async () => {
    const res = await api('POST', '/auth/login', {
      body: { email: 'nobody@orvexa.example', password: 'Password123' },
    })
    expect(res.status).toBe(401)
  })

  test('POST /auth/login returns 400 when the body is incomplete', async () => {
    const res = await api('POST', '/auth/login', { body: { email: 'demo@orvexa.example' } })
    expect(res.status).toBe(400)
  })

  test('POST /auth/logout returns 401 without authentication', async () => {
    const res = await api('POST', '/auth/logout')
    expect(res.status).toBe(401)
  })

  test('POST /auth/logout clears the cookie when authenticated', async () => {
    const res = await api('POST', '/auth/logout', { auth: true })
    expect(res.status).toBe(200)

    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('access_token=;')
    expect(cookie).toContain('Max-Age=0')
  })

  test('POST /auth/logout accepts the access_token cookie', async () => {
    const res = await api('POST', '/auth/logout', {
      headers: { Cookie: `access_token=${ACCESS_TOKEN}` },
    })
    expect(res.status).toBe(200)
  })

  test('POST /auth/logout rejects a wrong bearer token', async () => {
    const res = await api('POST', '/auth/logout', {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect(res.status).toBe(401)
  })

  test('POST /auth/refresh returns a new access token', async () => {
    const res = await api('POST', '/auth/refresh', { body: { refreshToken: REFRESH_TOKEN } })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.accessToken).toBe(ACCESS_TOKEN)
  })

  test('POST /auth/refresh returns 401 for an invalid refresh token', async () => {
    const res = await api('POST', '/auth/refresh', { body: { refreshToken: 'nope' } })
    expect(res.status).toBe(401)
  })

  test('POST /auth/refresh returns 400 when the token is missing', async () => {
    const res = await api('POST', '/auth/refresh', { body: {} })
    expect(res.status).toBe(400)
  })

  test('POST /auth/forgot-password always gives the same answer', async () => {
    const known = await api('POST', '/auth/forgot-password', {
      body: { email: 'demo@orvexa.example' },
    })
    const unknown = await api('POST', '/auth/forgot-password', {
      body: { email: 'ghost@orvexa.example' },
    })

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(await readBody(known)).toEqual(await readBody(unknown))
  })

  test('POST /auth/forgot-password returns 400 for an invalid email', async () => {
    const res = await api('POST', '/auth/forgot-password', { body: { email: 'invalid' } })
    expect(res.status).toBe(400)
  })

  test('POST /auth/reset-password updates the password with the demo token', async () => {
    const res = await api('POST', '/auth/reset-password', {
      body: { token: RESET_TOKEN, password: 'NewPassword123' },
    })
    expect(res.status).toBe(200)
  })

  test('POST /auth/reset-password returns 401 for an invalid token', async () => {
    const res = await api('POST', '/auth/reset-password', {
      body: { token: 'bad-token', password: 'NewPassword123' },
    })
    expect(res.status).toBe(401)
  })

  test('POST /auth/reset-password returns 400 for a short password', async () => {
    const res = await api('POST', '/auth/reset-password', {
      body: { token: RESET_TOKEN, password: 'short' },
    })
    expect(res.status).toBe(400)
  })
})

// Users

describe('Users', () => {
  test('GET /users returns the paginated list', async () => {
    const res = await api('GET', '/users')
    expect(res.status).toBe(200)

    const body = await readBody<ListBody>(res)
    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
    expect(body.data).toHaveLength(3)
  })

  test('GET /users respects page and limit', async () => {
    const first = await readBody<ListBody>(await api('GET', '/users?page=1&limit=2'))
    const second = await readBody<ListBody>(await api('GET', '/users?page=2&limit=2'))

    expect(first.data).toHaveLength(2)
    expect(second.data).toHaveLength(1)
    expect(second.data[0]?.id).toBe(3)
    expect(second.total).toBe(3)
  })

  test('GET /users clamps the limit to 100', async () => {
    const body = await readBody<ListBody>(await api('GET', '/users?limit=1000'))
    expect(body.limit).toBe(100)
  })

  test('GET /users returns an empty page past the end', async () => {
    const body = await readBody<ListBody>(await api('GET', '/users?page=10&limit=5'))
    expect(body.data).toHaveLength(0)
    expect(body.total).toBe(3)
  })

  test('GET /users returns 400 for a non-numeric page', async () => {
    const res = await api('GET', '/users?page=abc')
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('Invalid query parameters.')
  })

  test('GET /users/:id returns one user', async () => {
    const res = await api('GET', '/users/1')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ id: 1, name: 'Zen Allaham', email: 'zen@orvexa.example' })
  })

  test('GET /users/:id returns 404 for an unknown user', async () => {
    const res = await api('GET', '/users/999')
    expect(res.status).toBe(404)
  })

  test('GET /users/:id returns 400 for an invalid id', async () => {
    const res = await api('GET', '/users/abc')
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('Invalid path parameters.')
  })

  test('POST /users creates a user', async () => {
    const res = await api('POST', '/users', {
      body: { name: 'Lina Nasser', email: 'lina@orvexa.example' },
    })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.name).toBe('Lina Nasser')
    expect(body.email).toBe('lina@orvexa.example')
    expect(Number(body.id)).toBeGreaterThan(1000)
  })

  test('POST /users does not persist the created user', async () => {
    await api('POST', '/users', { body: { name: 'Temp User', email: 'temp@orvexa.example' } })

    const body = await readBody<ListBody>(await api('GET', '/users'))
    expect(body.total).toBe(3)
  })

  test('POST /users returns 409 for an existing email', async () => {
    const res = await api('POST', '/users', {
      body: { name: 'Duplicate', email: 'zen@orvexa.example' },
    })
    expect(res.status).toBe(409)
  })

  test('POST /users returns 400 for a name that is too short', async () => {
    const res = await api('POST', '/users', { body: { name: 'A', email: 'a@orvexa.example' } })
    expect(res.status).toBe(400)
  })

  test('POST /users returns 400 for a JSON array body', async () => {
    const res = await api('POST', '/users', { rawBody: '[]' })
    expect(res.status).toBe(400)
  })

  test('PATCH /users/:id updates the supplied fields', async () => {
    const res = await api('PATCH', '/users/2', { body: { name: 'Sara H.' } })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ id: 2, name: 'Sara H.', email: 'sara@orvexa.example' })
  })

  test('PATCH /users/:id with an empty body keeps the user unchanged', async () => {
    const res = await api('PATCH', '/users/2', { body: {} })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ id: 2, name: 'Sara Haddad', email: 'sara@orvexa.example' })
  })

  test('PATCH /users/:id returns 404 for an unknown user', async () => {
    const res = await api('PATCH', '/users/999', { body: { name: 'Nobody' } })
    expect(res.status).toBe(404)
  })

  test('PATCH /users/:id returns 400 for an invalid email', async () => {
    const res = await api('PATCH', '/users/1', { body: { email: 'broken' } })
    expect(res.status).toBe(400)
  })

  test('DELETE /users/:id deletes an existing user', async () => {
    const res = await api('DELETE', '/users/3')
    expect(res.status).toBe(200)
  })

  test('DELETE /users/:id leaves the data untouched', async () => {
    const res = await api('GET', '/users/3')
    expect(res.status).toBe(200)
  })

  test('DELETE /users/:id returns 404 for an unknown user', async () => {
    const res = await api('DELETE', '/users/999')
    expect(res.status).toBe(404)
  })

  test('DELETE /users/:id returns 400 for an invalid id', async () => {
    const res = await api('DELETE', '/users/abc')
    expect(res.status).toBe(400)
  })
})

// Profiles

describe('Profiles', () => {
  test('GET /profile returns 401 without authentication', async () => {
    const res = await api('GET', '/profile')
    expect(res.status).toBe(401)
  })

  test('GET /profile returns the authenticated profile', async () => {
    const res = await api('GET', '/profile', { auth: true })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.id).toBe(1)
    expect(body.displayName).toBe('Zen')
  })

  test('GET /profile accepts the cookie session', async () => {
    const res = await api('GET', '/profile', {
      headers: { Cookie: `access_token=${ACCESS_TOKEN}` },
    })
    expect(res.status).toBe(200)
  })

  test('GET /profiles/:id returns a public profile', async () => {
    const res = await api('GET', '/profiles/2')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.displayName).toBe('Sara')
    expect(body.userId).toBe(2)
  })

  test('GET /profiles/:id returns a null bio when none is set', async () => {
    const body = await readBody(await api('GET', '/profiles/3'))
    expect(body.bio).toBeNull()
  })

  test('GET /profiles/:id returns 404 for an unknown profile', async () => {
    const res = await api('GET', '/profiles/999')
    expect(res.status).toBe(404)
  })

  test('GET /profiles/:id returns 400 for an invalid id', async () => {
    const res = await api('GET', '/profiles/abc')
    expect(res.status).toBe(400)
  })

  test('PATCH /profile returns 401 without authentication', async () => {
    const res = await api('PATCH', '/profile', { body: { displayName: 'Changed' } })
    expect(res.status).toBe(401)
  })

  test('PATCH /profile updates the display name', async () => {
    const res = await api('PATCH', '/profile', {
      auth: true,
      body: { displayName: 'Zen Updated' },
    })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.displayName).toBe('Zen Updated')
    expect(body.userId).toBe(1)
  })

  test('PATCH /profile can set the bio to null', async () => {
    const res = await api('PATCH', '/profile', { auth: true, body: { bio: null } })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.bio).toBeNull()
  })

  test('PATCH /profile returns 400 for a body that is not JSON', async () => {
    const res = await api('PATCH', '/profile', { auth: true, rawBody: '{' })
    expect(res.status).toBe(400)
  })
})

// Services

describe('Services', () => {
  test('GET /services returns the list', async () => {
    const res = await api('GET', '/services')
    expect(res.status).toBe(200)

    const body = await readBody<ListBody>(res)
    expect(body.total).toBe(3)
    expect(body.data.map((service) => service.id)).toEqual([1, 2, 3])
  })

  test('GET /services searches title and description', async () => {
    const byTitle = await readBody<ListBody>(await api('GET', '/services?search=logo'))
    expect(byTitle.total).toBe(1)
    expect(byTitle.data[0]?.id).toBe(2)

    const byDescription = await readBody<ListBody>(await api('GET', '/services?search=docs'))
    expect(byDescription.total).toBe(1)
    expect(byDescription.data[0]?.id).toBe(3)
  })

  test('GET /services search is case-insensitive', async () => {
    const body = await readBody<ListBody>(await api('GET', '/services?search=REST'))
    expect(body.total).toBe(1)
    expect(body.data[0]?.id).toBe(1)
  })

  test('GET /services returns nothing when the search has no match', async () => {
    const body = await readBody<ListBody>(await api('GET', '/services?search=zzz'))
    expect(body.total).toBe(0)
    expect(body.data).toHaveLength(0)
  })

  test('GET /services sorts by price ascending', async () => {
    const body = await readBody<ListBody>(await api('GET', '/services?sort=price&order=asc'))
    expect(body.data.map((service) => service.price)).toEqual([150, 300, 450])
  })

  test('GET /services sorts by price descending', async () => {
    const body = await readBody<ListBody>(await api('GET', '/services?sort=price&order=desc'))
    expect(body.data.map((service) => service.price)).toEqual([450, 300, 150])
  })

  test('GET /services sorts by title', async () => {
    const body = await readBody<ListBody>(await api('GET', '/services?sort=title'))
    expect(body.data.map((service) => service.id)).toEqual([2, 1, 3])
  })

  test('GET /services ignores an unknown sort field', async () => {
    const body = await readBody<ListBody>(await api('GET', '/services?sort=unknown'))
    expect(body.data.map((service) => service.id)).toEqual([1, 2, 3])
  })

  test('GET /services/:id returns a service', async () => {
    const res = await api('GET', '/services/1')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.title).toBe('REST API development')
    expect(body.price).toBe(450)
    expect(body.sellerId).toBe(1)
  })

  test('GET /services/:id returns 404 for an unknown service', async () => {
    const res = await api('GET', '/services/999')
    expect(res.status).toBe(404)
  })

  test('GET /services/:id returns 400 for an invalid id', async () => {
    const res = await api('GET', '/services/abc')
    expect(res.status).toBe(400)
  })

  test('POST /services returns 401 without authentication', async () => {
    const res = await api('POST', '/services', {
      body: { title: 'New service', description: 'Something new.', price: 100 },
    })
    expect(res.status).toBe(401)
  })

  test('POST /services creates a service when authenticated', async () => {
    const res = await api('POST', '/services', {
      auth: true,
      body: { title: 'New service', description: 'Something new.', price: 100 },
    })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.title).toBe('New service')
    expect(body.price).toBe(100)
    expect(body.sellerId).toBe(1)
    expect(Number(body.id)).toBeGreaterThan(1000)
  })

  test('POST /services returns 400 for a price that is not positive', async () => {
    const res = await api('POST', '/services', {
      auth: true,
      body: { title: 'Free service', description: 'Nothing to pay.', price: -5 },
    })
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('The price must be greater than zero.')
  })

  test('POST /services returns 400 when required fields are missing', async () => {
    const res = await api('POST', '/services', { auth: true, body: { title: 'Only a title' } })
    expect(res.status).toBe(400)
  })

  test('PATCH /services/:id updates the supplied fields', async () => {
    const res = await api('PATCH', '/services/1', { body: { title: 'Renamed', price: 500 } })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.title).toBe('Renamed')
    expect(body.price).toBe(500)
    expect(body.description).toBe('Production-ready REST APIs.')
  })

  test('PATCH /services/:id returns 404 for an unknown service', async () => {
    const res = await api('PATCH', '/services/999', { body: { title: 'Ghost' } })
    expect(res.status).toBe(404)
  })

  test('PATCH /services/:id returns 400 for a negative price', async () => {
    const res = await api('PATCH', '/services/1', { body: { price: -1 } })
    expect(res.status).toBe(400)
  })

  test('DELETE /services/:id deletes an existing service', async () => {
    const res = await api('DELETE', '/services/2')
    expect(res.status).toBe(200)
  })

  test('DELETE /services/:id returns 404 for an unknown service', async () => {
    const res = await api('DELETE', '/services/999')
    expect(res.status).toBe(404)
  })

  test('HEAD /services/:id returns 200 with the id header and no body', async () => {
    const res = await api('HEAD', '/services/1')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-service-id')).toBe('1')
    expect(await res.text()).toBe('')
  })

  test('HEAD /services/:id returns 404 for an unknown service', async () => {
    const res = await api('HEAD', '/services/999')
    expect(res.status).toBe(404)
  })

  test('HEAD /services/:id returns 400 for an invalid id', async () => {
    const res = await api('HEAD', '/services/abc')
    expect(res.status).toBe(400)
  })
})

// Carts

describe('Carts', () => {
  test('GET /cart returns 401 without authentication', async () => {
    const res = await api('GET', '/cart')
    expect(res.status).toBe(401)
  })

  test('GET /cart returns the items and the computed total', async () => {
    const res = await api('GET', '/cart', { auth: true })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.items).toEqual([{ id: 1, serviceId: 1, quantity: 2 }])
    expect(body.total).toBe(900)
    expect(body.currency).toBe('USD')
  })

  test('POST /cart/items adds an item', async () => {
    const res = await api('POST', '/cart/items', { body: { serviceId: 2, quantity: 3 } })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.serviceId).toBe(2)
    expect(body.quantity).toBe(3)
    expect(Number(body.id)).toBeGreaterThan(1000)
  })

  test('POST /cart/items returns 400 for a quantity above 100', async () => {
    const res = await api('POST', '/cart/items', { body: { serviceId: 1, quantity: 101 } })
    expect(res.status).toBe(400)
  })

  test('POST /cart/items returns 400 for a fractional quantity', async () => {
    const res = await api('POST', '/cart/items', { body: { serviceId: 1, quantity: 1.5 } })
    expect(res.status).toBe(400)
  })

  test('POST /cart/items returns 404 for an unknown service', async () => {
    const res = await api('POST', '/cart/items', { body: { serviceId: 999, quantity: 1 } })
    expect(res.status).toBe(404)
  })

  test('POST /cart/items returns 400 when the body is incomplete', async () => {
    const res = await api('POST', '/cart/items', { body: { serviceId: 1 } })
    expect(res.status).toBe(400)
  })

  test('DELETE /cart/items/:id removes an existing item', async () => {
    const res = await api('DELETE', '/cart/items/1')
    expect(res.status).toBe(200)
  })

  test('DELETE /cart/items/:id returns 404 for an unknown item', async () => {
    const res = await api('DELETE', '/cart/items/999')
    expect(res.status).toBe(404)
  })

  test('DELETE /cart/items/:id returns 400 for an invalid id', async () => {
    const res = await api('DELETE', '/cart/items/abc')
    expect(res.status).toBe(400)
  })
})

// Orders

describe('Orders', () => {
  test('GET /orders returns the list', async () => {
    const body = await readBody<ListBody>(await api('GET', '/orders'))
    expect(body.total).toBe(2)
    expect(body.data).toHaveLength(2)
  })

  test('GET /orders searches by status', async () => {
    const body = await readBody<ListBody>(await api('GET', '/orders?search=paid'))
    expect(body.total).toBe(1)
    expect(body.data[0]?.id).toBe(1)
  })

  test('GET /orders sorts by id descending', async () => {
    const body = await readBody<ListBody>(await api('GET', '/orders?sort=id&order=desc'))
    expect(body.data.map((order) => order.id)).toEqual([2, 1])
  })

  test('GET /orders/:id returns one order', async () => {
    const res = await api('GET', '/orders/1')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ id: 1, buyerId: 3, serviceId: 1, status: 'paid' })
  })

  test('GET /orders/:id returns 404 for an unknown order', async () => {
    const res = await api('GET', '/orders/999')
    expect(res.status).toBe(404)
  })

  test('GET /orders/:id returns 400 for an invalid id', async () => {
    const res = await api('GET', '/orders/abc')
    expect(res.status).toBe(400)
  })

  test('POST /orders creates a pending order', async () => {
    const res = await api('POST', '/orders', { body: { serviceId: 1, quantity: 2 } })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.buyerId).toBe(3)
    expect(body.serviceId).toBe(1)
    expect(body.status).toBe('pending')
    expect(Number(body.id)).toBeGreaterThan(1000)
  })

  test('POST /orders returns 400 for a quantity above 100', async () => {
    const res = await api('POST', '/orders', { body: { serviceId: 1, quantity: 101 } })
    expect(res.status).toBe(400)
  })

  test('POST /orders returns 404 for an unknown service', async () => {
    const res = await api('POST', '/orders', { body: { serviceId: 999, quantity: 1 } })
    expect(res.status).toBe(404)
  })

  test('POST /orders returns 400 when the body is incomplete', async () => {
    const res = await api('POST', '/orders', { body: { quantity: 1 } })
    expect(res.status).toBe(400)
  })
})

// Contracts

describe('Contracts', () => {
  test('GET /contracts returns the list', async () => {
    const body = await readBody<ListBody>(await api('GET', '/contracts'))
    expect(body.total).toBe(2)
  })

  test('GET /contracts/:id returns one contract', async () => {
    const res = await api('GET', '/contracts/1')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ id: 1, orderId: 1, status: 'pending' })
  })

  test('GET /contracts/:id returns 404 for an unknown contract', async () => {
    const res = await api('GET', '/contracts/999')
    expect(res.status).toBe(404)
  })

  test('GET /contracts/:id returns 400 for an invalid id', async () => {
    const res = await api('GET', '/contracts/abc')
    expect(res.status).toBe(400)
  })

  test('POST /contracts/:id/accept accepts a pending contract', async () => {
    const res = await api('POST', '/contracts/1/accept')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.id).toBe(1)
    expect(body.status).toBe('accepted')
  })

  test('POST /contracts/:id/accept returns 400 for an already accepted contract', async () => {
    const res = await api('POST', '/contracts/2/accept')
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('The contract cannot be accepted in its current state.')
  })

  test('POST /contracts/:id/accept returns 404 for an unknown contract', async () => {
    const res = await api('POST', '/contracts/999/accept')
    expect(res.status).toBe(404)
  })
})

// Messages

describe('Messages', () => {
  test('GET /conversations/:id/messages returns 401 without authentication', async () => {
    const res = await api('GET', '/conversations/1/messages')
    expect(res.status).toBe(401)
  })

  test('GET /conversations/:id/messages returns the conversation messages', async () => {
    const res = await api('GET', '/conversations/1/messages', { auth: true })
    expect(res.status).toBe(200)

    const body = await readBody<ListBody>(res)
    expect(body.total).toBe(2)
    expect(body.data.every((message) => message.conversationId === 1)).toBe(true)
  })

  test('GET /conversations/:id/messages respects the limit', async () => {
    const body = await readBody<ListBody>(
      await api('GET', '/conversations/1/messages?limit=1', { auth: true }),
    )
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(2)
  })

  test('GET /conversations/:id/messages returns 404 for an unknown conversation', async () => {
    const res = await api('GET', '/conversations/99/messages', { auth: true })
    expect(res.status).toBe(404)
  })

  test('GET /conversations/:id/messages returns 400 for an invalid id', async () => {
    const res = await api('GET', '/conversations/abc/messages', { auth: true })
    expect(res.status).toBe(400)
  })

  test('POST /messages returns 401 without authentication', async () => {
    const res = await api('POST', '/messages', { body: { conversationId: 1, content: 'Hello' } })
    expect(res.status).toBe(401)
  })

  test('POST /messages sends a message', async () => {
    const res = await api('POST', '/messages', {
      auth: true,
      body: { conversationId: 1, content: 'Hello there' },
    })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.conversationId).toBe(1)
    expect(body.senderId).toBe(1)
    expect(body.content).toBe('Hello there')
  })

  test('POST /messages returns 400 for blank content', async () => {
    const res = await api('POST', '/messages', {
      auth: true,
      body: { conversationId: 1, content: '   ' },
    })
    expect(res.status).toBe(400)
  })

  test('POST /messages returns 404 for an unknown conversation', async () => {
    const res = await api('POST', '/messages', {
      auth: true,
      body: { conversationId: 99, content: 'Hello' },
    })
    expect(res.status).toBe(404)
  })
})

// Notifications

describe('Notifications', () => {
  test('GET /notifications returns the list', async () => {
    const body = await readBody<ListBody>(await api('GET', '/notifications'))
    expect(body.total).toBe(2)
    expect(body.data[0]?.isRead).toBe(false)
  })

  test('PATCH /notifications/:id/read marks a notification as read', async () => {
    const res = await api('PATCH', '/notifications/1/read')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.id).toBe(1)
    expect(body.isRead).toBe(true)
  })

  test('PATCH /notifications/:id/read returns 404 for an unknown notification', async () => {
    const res = await api('PATCH', '/notifications/999/read')
    expect(res.status).toBe(404)
  })

  test('PATCH /notifications/:id/read returns 400 for an invalid id', async () => {
    const res = await api('PATCH', '/notifications/abc/read')
    expect(res.status).toBe(400)
  })
})

// Reviews

describe('Reviews', () => {
  test('GET /services/:id/reviews returns the reviews of a service', async () => {
    const res = await api('GET', '/services/1/reviews')
    expect(res.status).toBe(200)

    const body = await readBody<ListBody>(res)
    expect(body.total).toBe(2)
    expect(body.data.every((review) => review.serviceId === 1)).toBe(true)
  })

  test('GET /services/:id/reviews returns an empty list for a service without reviews', async () => {
    const body = await readBody<ListBody>(await api('GET', '/services/3/reviews'))
    expect(body.total).toBe(0)
    expect(body.data).toHaveLength(0)
  })

  test('GET /services/:id/reviews returns 404 for an unknown service', async () => {
    const res = await api('GET', '/services/999/reviews')
    expect(res.status).toBe(404)
  })

  test('GET /services/:id/reviews returns 400 for an invalid id', async () => {
    const res = await api('GET', '/services/abc/reviews')
    expect(res.status).toBe(400)
  })

  test('POST /reviews creates a review', async () => {
    const res = await api('POST', '/reviews', {
      body: { serviceId: 1, rating: 5, comment: 'Great work.' },
    })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.serviceId).toBe(1)
    expect(body.rating).toBe(5)
    expect(body.comment).toBe('Great work.')
  })

  test('POST /reviews returns 400 for a rating above 5', async () => {
    const res = await api('POST', '/reviews', { body: { serviceId: 1, rating: 6 } })
    expect(res.status).toBe(400)
  })

  test('POST /reviews returns 400 for a fractional rating', async () => {
    const res = await api('POST', '/reviews', { body: { serviceId: 1, rating: 3.5 } })
    expect(res.status).toBe(400)
  })

  test('POST /reviews returns 404 for an unknown service', async () => {
    const res = await api('POST', '/reviews', { body: { serviceId: 999, rating: 4 } })
    expect(res.status).toBe(404)
  })
})

// Payments

describe('Payments', () => {
  test('GET /payments/:id returns one payment', async () => {
    const res = await api('GET', '/payments/1')
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ id: 1, orderId: 1, amount: 450, status: 'completed' })
  })

  test('GET /payments/:id returns 404 for an unknown payment', async () => {
    const res = await api('GET', '/payments/999')
    expect(res.status).toBe(404)
  })

  test('GET /payments/:id returns 400 for an invalid id', async () => {
    const res = await api('GET', '/payments/abc')
    expect(res.status).toBe(400)
  })

  test('POST /payments creates a pending payment', async () => {
    const res = await api('POST', '/payments', { body: { orderId: 2, amount: 300 } })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.orderId).toBe(2)
    expect(body.amount).toBe(300)
    expect(body.status).toBe('pending')
  })

  test('POST /payments returns 400 for a negative amount', async () => {
    const res = await api('POST', '/payments', { body: { orderId: 1, amount: -10 } })
    expect(res.status).toBe(400)
  })

  test('POST /payments returns 404 for an unknown order', async () => {
    const res = await api('POST', '/payments', { body: { orderId: 999, amount: 100 } })
    expect(res.status).toBe(404)
  })

  test('POST /payments returns 400 when the body is incomplete', async () => {
    const res = await api('POST', '/payments', { body: { orderId: 1 } })
    expect(res.status).toBe(400)
  })
})

// Platform wallets

describe('Platform wallets', () => {
  test('GET /wallet returns 401 without authentication', async () => {
    const res = await api('GET', '/wallet')
    expect(res.status).toBe(401)
  })

  test('GET /wallet returns the wallet when authenticated', async () => {
    const res = await api('GET', '/wallet', { auth: true })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ id: 1, userId: 1, balance: 1250, currency: 'USD' })
  })

  test('GET /wallet/transactions returns the transaction history', async () => {
    const res = await api('GET', '/wallet/transactions')
    expect(res.status).toBe(200)

    const body = await readBody<ListBody>(res)
    expect(body.total).toBe(2)
    expect(body.data.map((transaction) => transaction.type)).toEqual(['credit', 'debit'])
  })

  test('GET /wallet/transactions returns 400 for an invalid limit', async () => {
    const res = await api('GET', '/wallet/transactions?limit=abc')
    expect(res.status).toBe(400)
  })
})

// File uploads

describe('File uploads', () => {
  test('POST /uploads returns 400 when the request is not multipart', async () => {
    const res = await api('POST', '/uploads', { body: { folder: 'docs' } })
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('The request must be multipart/form-data.')
  })

  test('POST /uploads stores nothing but describes the uploaded file', async () => {
    const form = new FormData()
    form.append('file', new File(['hello world'], 'hello.txt', { type: 'text/plain' }))
    form.append('folder', 'documents')

    const res = await fetch(`${BASE_URL}/uploads`, { method: 'POST', body: form })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.name).toBe('hello.txt')
    expect(body.size).toBe(11)
    expect(body.type).toContain('text/plain')
    expect(body.folder).toBe('documents')
    expect(Number(body.id)).toBeGreaterThan(1000)
  })

  test('POST /uploads returns a null folder when none is sent', async () => {
    const form = new FormData()
    form.append('file', new File(['data'], 'data.bin'))

    const res = await fetch(`${BASE_URL}/uploads`, { method: 'POST', body: form })
    expect(res.status).toBe(201)

    const body = await readBody(res)
    expect(body.folder).toBeNull()
  })

  test('POST /uploads returns 400 when the file part is missing', async () => {
    const form = new FormData()
    form.append('folder', 'documents')

    const res = await fetch(`${BASE_URL}/uploads`, { method: 'POST', body: form })
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('A "file" part is required.')
  })

  test('POST /uploads returns 400 for an empty file', async () => {
    const form = new FormData()
    form.append('file', new File([], 'empty.txt', { type: 'text/plain' }))

    const res = await fetch(`${BASE_URL}/uploads`, { method: 'POST', body: form })
    expect(res.status).toBe(400)

    const body = await readBody(res)
    expect(body.message).toBe('The uploaded file is empty.')
  })

  test('POST /uploads returns 413 for a file above 5 MB', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.bin'))

    const res = await fetch(`${BASE_URL}/uploads`, { method: 'POST', body: form })
    expect(res.status).toBe(413)
  })

  test('POST /uploads accepts a file of exactly 5 MB', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array(5 * 1024 * 1024)], 'limit.bin'))

    const res = await fetch(`${BASE_URL}/uploads`, { method: 'POST', body: form })
    expect(res.status).toBe(201)
  })
})

// Utilities

describe('Utilities', () => {
  test('GET /legacy/search returns the deprecation header and results', async () => {
    const res = await api('GET', '/legacy/search')
    expect(res.status).toBe(200)
    expect(res.headers.get('deprecation')).toBe('true')

    const body = await readBody<{ deprecated: boolean; results: Json[] }>(res)
    expect(body.deprecated).toBe(true)
    expect(body.results).toHaveLength(3)
  })

  test('GET /legacy/search only exposes id and title', async () => {
    const body = await readBody<{ results: Json[] }>(await api('GET', '/legacy/search'))
    expect(Object.keys(body.results[0] ?? {}).sort()).toEqual(['id', 'title'])
  })

  test('GET /legacy/search filters by the search term', async () => {
    const body = await readBody<{ results: Json[] }>(await api('GET', '/legacy/search?search=logo'))
    expect(body.results).toEqual([{ id: 2, title: 'Logo and brand identity' }])
  })

  test('GET /legacy/search echoes the client version header', async () => {
    const res = await api('GET', '/legacy/search', { headers: { 'X-Client-Version': '1.2.3' } })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body.clientVersion).toBe('1.2.3')
  })

  test('GET /legacy/search returns a null client version when the header is absent', async () => {
    const body = await readBody(await api('GET', '/legacy/search'))
    expect(body.clientVersion).toBeNull()
  })

  test('GET /legacy/search returns 400 for an invalid query', async () => {
    const res = await api('GET', '/legacy/search?page=abc')
    expect(res.status).toBe(400)
  })

  test('GET /utilities/api-key-status accepts the demo query key', async () => {
    const res = await api('GET', `/utilities/api-key-status?api_key=${API_KEY}`)
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ status: 'valid', scheme: 'ApiKeyQuery' })
  })

  test('GET /utilities/api-key-status returns 401 for a wrong key', async () => {
    const res = await api('GET', '/utilities/api-key-status?api_key=wrong')
    expect(res.status).toBe(401)
  })

  test('GET /utilities/api-key-status returns 401 without a key', async () => {
    const res = await api('GET', '/utilities/api-key-status')
    expect(res.status).toBe(401)
  })

  test('GET /utilities/api-key-header-status accepts the demo header key', async () => {
    const res = await api('GET', '/utilities/api-key-header-status', {
      headers: { 'X-API-Key': API_KEY },
    })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ status: 'valid', scheme: 'ApiKeyHeader' })
  })

  test('GET /utilities/api-key-header-status returns 401 for a wrong key', async () => {
    const res = await api('GET', '/utilities/api-key-header-status', {
      headers: { 'X-API-Key': 'wrong' },
    })
    expect(res.status).toBe(401)
  })

  test('GET /utilities/api-key-header-status returns 401 without a key', async () => {
    const res = await api('GET', '/utilities/api-key-header-status')
    expect(res.status).toBe(401)
  })

  test('GET /utilities/cookie-session accepts the access_token cookie', async () => {
    const res = await api('GET', '/utilities/cookie-session', {
      headers: { Cookie: `access_token=${ACCESS_TOKEN}` },
    })
    expect(res.status).toBe(200)

    const body = await readBody(res)
    expect(body).toEqual({ status: 'valid', scheme: 'CookieAuth' })
  })

  test('GET /utilities/cookie-session finds the cookie among several', async () => {
    const res = await api('GET', '/utilities/cookie-session', {
      headers: { Cookie: `theme=dark; access_token=${ACCESS_TOKEN}; lang=en` },
    })
    expect(res.status).toBe(200)
  })

  test('GET /utilities/cookie-session returns 401 for a wrong cookie', async () => {
    const res = await api('GET', '/utilities/cookie-session', {
      headers: { Cookie: 'access_token=wrong' },
    })
    expect(res.status).toBe(401)
  })

  test('GET /utilities/cookie-session does not accept a bearer token', async () => {
    const res = await api('GET', '/utilities/cookie-session', { auth: true })
    expect(res.status).toBe(401)
  })

  test('GET /utilities/cookie-session returns 401 without a cookie', async () => {
    const res = await api('GET', '/utilities/cookie-session')
    expect(res.status).toBe(401)
  })
})
