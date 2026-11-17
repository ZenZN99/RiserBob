/**
 * Runnable example:  bun run examples/hirehub.ts
 * Then open http://localhost:4000/docs
 */
import { defineSchema, passwordRules, RiserBob, rules, Validator } from 'riser-bob'
import { OpenAPI } from '../src/index.js'
// In your own project: import { OpenAPI } from '@riser-bob/openapi'

// 1. Write each schema ONCE: RiserBob validates with it, the docs are generated from it.
const CreateUser = defineSchema({
  name: rules(['required', 'string', 'minLength:2', 'maxLength:50']),
  email: rules(['required', 'email']),
  role: rules(['nullable', 'enum:admin,member']),
  password: passwordRules(['required', 'string', 'minLength:8', 'confirmed']),
})
const UserQuery = defineSchema({
  page: rules(['nullable', 'number', 'min:1']),
  search: rules(['nullable', 'string']),
})
const UserParams = defineSchema({ id: rules(['required', 'string']) })
const UserResponse = defineSchema({
  id: rules(['required', 'string']),
  name: rules(['required', 'string']),
  email: rules(['required', 'email']),
})

// 2. Register routes as usual: no documentation metadata here.
const bob = new RiserBob()

bob.spongGet('/users', (_spongReq, spongRes) => spongRes.json([]))

bob.spongPost('/users', async (spongReq, spongRes) => {
  const result = Validator.validate(await spongReq.json<Record<string, unknown>>(), CreateUser)
  if (!result.valid) return spongRes.json({ errors: result.errors }, 422)
  return spongRes.json({ id: '1', name: result.data }, 201)
})

bob.spongGet('/users/:id', (spongReq, spongRes) =>
  spongRes.json({ id: spongReq.params['id'], name: 'Bob', email: 'bob@example.com' }),
)

// 3. Document everything in one place, then set it up AFTER the routes exist.
const openapi = new OpenAPI({
  info: {
    title: 'HireHub REST API',
    version: '1.0.0',
    description: 'HireHub REST API Documentation',
  },
  docs: '/docs',
  json: '/docs/json',
  securitySchemes: {
    BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  },

  routes: {
    getUsers: {
      method: 'GET',
      path: '/users',
      summary: 'Get all users',
      description: 'Returns all registered users',
      tags: ['Users'],
      security: ['BearerAuth'],
      request: { query: UserQuery },
      response: {
        200: { description: 'Users retrieved successfully' },
        401: { description: 'Unauthorized' },
      },
    },
    createUser: {
      method: 'POST',
      path: '/users',
      summary: 'Create a new user',
      tags: ['Users'],
      request: { body: CreateUser },
      response: {
        201: { description: 'User created successfully', schema: UserResponse },
        422: { description: 'Validation failed' },
      },
    },
    getUser: {
      method: 'GET',
      path: '/users/:id',
      summary: 'Get user by ID',
      tags: ['Users'],
      request: { params: UserParams },
      response: {
        200: { description: 'User found', schema: UserResponse },
        404: { description: 'User not found' },
      },
    },
    // Optional: only documented when it is really registered.
    legacyUsers: {
      method: 'GET',
      path: '/legacy/users',
      isRequired: false,
      deprecated: true,
      response: { 200: { description: 'Legacy list' } },
    },
  },
})

openapi.setup(bob)

bob.spongListen(4000, () => {
  console.log('HireHub API on http://localhost:4000  (docs: /docs, spec: /docs/json)')
})
