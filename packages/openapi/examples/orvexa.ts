import type { FormDataEntryValue } from 'bun'
import { OpenAPI } from '../src'
import {
  RiserBob,
  defineSchema,
  rules,
  Validator,
  type SpongRequest,
  type ValidationSchema,
  type SpongHandler,
  type SpongResponse,
} from 'riser-bob'

// Application

const bob = new RiserBob()

// Reusable schemas

const IdParamsSchema = defineSchema({
  id: rules(['required', 'number']),
})

const PaginationQuerySchema = defineSchema({
  page: rules(['nullable', 'number']),
  limit: rules(['nullable', 'number']),
})

const SearchQuerySchema = defineSchema({
  search: rules(['nullable', 'string']),
  page: rules(['nullable', 'number']),
  limit: rules(['nullable', 'number']),
  sort: rules(['nullable', 'string']),
  order: rules(['nullable', 'string']),
})

const UserSchema = defineSchema({
  id: rules(['required', 'number']),
  name: rules(['required', 'string']),
  email: rules(['required', 'email']),
})

const CreateUserSchema = defineSchema({
  name: rules(['required', 'string', 'minLength:2']),
  email: rules(['required', 'email']),
})

const UpdateUserSchema = defineSchema({
  name: rules(['nullable', 'string', 'minLength:2']),
  email: rules(['nullable', 'email']),
})

const ProfileSchema = defineSchema({
  id: rules(['required', 'number']),
  userId: rules(['required', 'number']),
  displayName: rules(['required', 'string']),
  bio: rules(['nullable', 'string']),
})

const UpdateProfileSchema = defineSchema({
  displayName: rules(['nullable', 'string']),
  bio: rules(['nullable', 'string']),
})

const RegisterSchema = defineSchema({
  name: rules(['required', 'string', 'minLength:2']),
  email: rules(['required', 'email']),
  password: rules(['required', 'string', 'minLength:8']),
})

const LoginSchema = defineSchema({
  email: rules(['required', 'email']),
  password: rules(['required', 'string']),
})

const AuthSessionSchema = defineSchema({
  id: rules(['required', 'number']),
  name: rules(['required', 'string']),
  email: rules(['required', 'email']),
  accessToken: rules(['required', 'string']),
  refreshToken: rules(['required', 'string']),
})

const RefreshTokenSchema = defineSchema({
  refreshToken: rules(['required', 'string']),
})

const PasswordResetRequestSchema = defineSchema({
  email: rules(['required', 'email']),
})

const PasswordResetSchema = defineSchema({
  token: rules(['required', 'string']),
  password: rules(['required', 'string', 'minLength:8']),
})

const ServiceSchema = defineSchema({
  id: rules(['required', 'number']),
  title: rules(['required', 'string']),
  description: rules(['required', 'string']),
  price: rules(['required', 'number']),
  sellerId: rules(['required', 'number']),
})

const CreateServiceSchema = defineSchema({
  title: rules(['required', 'string']),
  description: rules(['required', 'string']),
  price: rules(['required', 'number']),
})

const UpdateServiceSchema = defineSchema({
  title: rules(['nullable', 'string']),
  description: rules(['nullable', 'string']),
  price: rules(['nullable', 'number']),
})

const CartItemSchema = defineSchema({
  serviceId: rules(['required', 'number']),
  quantity: rules(['required', 'number']),
})

const OrderSchema = defineSchema({
  id: rules(['required', 'number']),
  buyerId: rules(['required', 'number']),
  serviceId: rules(['required', 'number']),
  status: rules(['required', 'string']),
})

const CreateOrderSchema = defineSchema({
  serviceId: rules(['required', 'number']),
  quantity: rules(['required', 'number']),
})

const ContractSchema = defineSchema({
  id: rules(['required', 'number']),
  orderId: rules(['required', 'number']),
  status: rules(['required', 'string']),
})

const MessageSchema = defineSchema({
  id: rules(['required', 'number']),
  conversationId: rules(['required', 'number']),
  senderId: rules(['required', 'number']),
  content: rules(['required', 'string']),
})

const SendMessageSchema = defineSchema({
  conversationId: rules(['required', 'number']),
  content: rules(['required', 'string']),
})

const NotificationSchema = defineSchema({
  id: rules(['required', 'number']),
  title: rules(['required', 'string']),
  message: rules(['required', 'string']),
  isRead: rules(['required', 'boolean']),
})

const ReviewSchema = defineSchema({
  id: rules(['required', 'number']),
  serviceId: rules(['required', 'number']),
  rating: rules(['required', 'number']),
  comment: rules(['nullable', 'string']),
})

const CreateReviewSchema = defineSchema({
  serviceId: rules(['required', 'number']),
  rating: rules(['required', 'number']),
  comment: rules(['nullable', 'string']),
})

const PaymentSchema = defineSchema({
  id: rules(['required', 'number']),
  orderId: rules(['required', 'number']),
  amount: rules(['required', 'number']),
  status: rules(['required', 'string']),
})

const CreatePaymentSchema = defineSchema({
  orderId: rules(['required', 'number']),
  amount: rules(['required', 'number']),
})

const WalletSchema = defineSchema({
  id: rules(['required', 'number']),
  userId: rules(['required', 'number']),
  balance: rules(['required', 'number']),
  currency: rules(['required', 'string']),
})

const UploadMetadataSchema = defineSchema({
  folder: rules(['nullable', 'string']),
})

const LegacyHeadersSchema = defineSchema({
  'x-client-version': rules(['nullable', 'string']),
})

// Demo data (static, in memory, no database)

// Everything below is read-only sample data. POST/PATCH/DELETE handlers validate
// the input and answer realistically, but nothing is persisted between requests.

const DEMO_ACCESS_TOKEN = 'demo-access-token'
const DEMO_REFRESH_TOKEN = 'demo-refresh-token'
const DEMO_RESET_TOKEN = 'demo-reset-token'
const DEMO_API_KEY = 'demo-key'
const DEMO_LOGIN = { email: 'demo@orvexa.example', password: 'Password123' }
const TAKEN_EMAIL = 'taken@orvexa.example'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const users = [
  { id: 1, name: 'Zen Allaham', email: 'zen@orvexa.example' },
  { id: 2, name: 'Sara Haddad', email: 'sara@orvexa.example' },
  { id: 3, name: 'Omar Khalil', email: 'omar@orvexa.example' },
]

const profiles = [
  { id: 1, userId: 1, displayName: 'Zen', bio: 'Full-stack developer and framework author.' },
  { id: 2, userId: 2, displayName: 'Sara', bio: 'Brand designer.' },
  { id: 3, userId: 3, displayName: 'Omar', bio: null },
]

const services = [
  {
    id: 1,
    title: 'REST API development',
    description: 'Production-ready REST APIs.',
    price: 450,
    sellerId: 1,
  },
  {
    id: 2,
    title: 'Logo and brand identity',
    description: 'A complete brand kit.',
    price: 300,
    sellerId: 2,
  },
  {
    id: 3,
    title: 'Technical documentation',
    description: 'Clear docs for your product.',
    price: 150,
    sellerId: 1,
  },
]

const orders = [
  { id: 1, buyerId: 3, serviceId: 1, status: 'paid' },
  { id: 2, buyerId: 3, serviceId: 2, status: 'pending' },
]

const contracts = [
  { id: 1, orderId: 1, status: 'pending' },
  { id: 2, orderId: 2, status: 'accepted' },
]

const messages = [
  { id: 1, conversationId: 1, senderId: 3, content: 'Hi! Is the API service still available?' },
  { id: 2, conversationId: 1, senderId: 1, content: 'Yes, happy to help. What do you need?' },
]

const notifications = [
  { id: 1, title: 'New order', message: 'You received a new order.', isRead: false },
  { id: 2, title: 'Payment received', message: 'Order #1 was paid.', isRead: true },
]

const reviews = [
  { id: 1, serviceId: 1, rating: 5, comment: 'Fast and professional.' },
  { id: 2, serviceId: 1, rating: 4, comment: null },
]

const payments = [
  { id: 1, orderId: 1, amount: 450, status: 'completed' },
  { id: 2, orderId: 2, amount: 300, status: 'pending' },
]

const wallet = { id: 1, userId: 1, balance: 1250, currency: 'USD' }

const walletTransactions = [
  { id: 1, type: 'credit', amount: 450, note: 'Payment for order #1' },
  { id: 2, type: 'debit', amount: 100, note: 'Withdrawal' },
]

const cart = {
  items: [{ id: 1, serviceId: 1, quantity: 2 }],
}

// Ids for records "created" by POST handlers (never stored).
let sampleIdCounter = 1000
const nextSampleId = (): number => ++sampleIdCounter

// Handler helpers

type Rec = Record<string, unknown>

const NUMERIC_KEYS = ['id', 'page', 'limit']

/** Drops empty values and turns numeric strings into numbers for known keys. */
function coerce(input: Record<string, string>): Rec {
  const out: Rec = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === '') continue
    out[key] = NUMERIC_KEYS.includes(key) && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value
  }
  return out
}

async function readJson(req: SpongRequest): Promise<Rec | null> {
  try {
    const data = await req.json<unknown>()
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Rec) : null
  } catch {
    return null
  }
}

interface HandleOptions {
  params?: ValidationSchema
  query?: ValidationSchema
  body?: ValidationSchema
}

interface Ctx<P, Q, B> {
  params: P
  query: Q
  body: B
}

/**
 * Wraps a handler with validation of path params, query string and JSON body.
 * Invalid input is answered with 400 before the handler runs.
 */
function handle<P = Rec, Q = Rec, B = Rec>(
  options: HandleOptions,
  fn: (ctx: Ctx<P, Q, B>, req: SpongRequest, res: SpongResponse) => Response | Promise<Response>,
): SpongHandler {
  return async (req, res) => {
    let params = {} as P
    let query = {} as Q
    let body = {} as B

    if (options.params) {
      const result = Validator.validate<P>(coerce(req.params), options.params)
      if (!result.valid) {
        return res.SpongBadRequest({ message: 'Invalid path parameters.', errors: result.errors })
      }
      params = result.data
    }

    if (options.query) {
      const result = Validator.validate<Q>(
        coerce(Object.fromEntries(req.query.entries())),
        options.query,
      )
      if (!result.valid) {
        return res.SpongBadRequest({ message: 'Invalid query parameters.', errors: result.errors })
      }
      query = result.data
    }

    if (options.body) {
      const raw = await readJson(req)
      if (!raw) {
        return res.SpongBadRequest({ message: 'The request body must be a valid JSON object.' })
      }
      const result = Validator.validate<B>(raw, options.body)
      if (!result.valid) {
        return res.SpongBadRequest({ message: 'Invalid request body.', errors: result.errors })
      }
      body = result.data
    }

    return fn({ params, query, body }, req, res)
  }
}

interface ListQuery {
  search?: string | null
  page?: number | null
  limit?: number | null
  sort?: string | null
  order?: string | null
}

/** Search, sort and paginate a static list. */
function listResponse<T extends Rec>(
  res: SpongResponse,
  items: T[],
  query: ListQuery,
  searchFields: (keyof T)[] = [],
): Response {
  let result = [...items]

  if (query.search && searchFields.length > 0) {
    const needle = query.search.toLowerCase()
    result = result.filter((item) =>
      searchFields.some((field) =>
        String(item[field] ?? '')
          .toLowerCase()
          .includes(needle),
      ),
    )
  }

  if (query.sort && result.length > 0 && query.sort in result[0]!) {
    const direction = query.order === 'desc' ? -1 : 1
    const key = query.sort as keyof T
    result.sort((a, b) => {
      const left = a[key] as string | number
      const right = b[key] as string | number
      return left < right ? -direction : left > right ? direction : 0
    })
  }

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)))
  const start = (page - 1) * limit

  return res.SpongOK({
    data: result.slice(start, start + limit),
    page,
    limit,
    total: result.length,
  })
}

const findById = <T extends { id: number }>(items: T[], id: number): T | undefined =>
  items.find((item) => item.id === id)

function getCookie(req: SpongRequest, name: string): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return null
}

/** Demo authentication: accepts the demo bearer token or the access_token cookie. */
function hasDemoAuth(req: SpongRequest): boolean {
  const authorization = req.headers.get('authorization')
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null
  return bearer === DEMO_ACCESS_TOKEN || getCookie(req, 'access_token') === DEMO_ACCESS_TOKEN
}

const unauthorizedBody = { message: 'Authentication is required.' }

// OpenAPI configuration

const openapi = new OpenAPI({
  info: {
    title: 'Orvexa Digital Services Platform API',
    version: '1.0.0',
    description:
      'Comprehensive API documentation for the Orvexa digital services marketplace. This file exercises the available OpenAPI route, request, response, security, server, and Swagger UI options, and every documented route has a working handler backed by static demo data (no database). Demo credentials: demo@orvexa.example / Password123, bearer token "demo-access-token", API key "demo-key". List endpoints respond with { data, page, limit, total }.',
    termsOfService: 'https://orvexa-digital.vercel.app/terms',
    contact: {
      name: 'Zen Allaham',
      url: 'https://zenallaham.com',
      email: 'zenallaham09@gmail.com',
    },
    license: {
      name: 'Proprietary',
      url: 'https://orvexa-digital.vercel.app/terms',
    },
  },

  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server',
    },
    {
      url: 'https://api.orvexa.example.com',
      description: 'Example production server URL',
    },
  ],

  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT access token sent in the Authorization header.',
    },
    CookieAuth: {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'JWT access token stored in an HTTP cookie.',
    },
    ApiKeyHeader: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'Example API key authentication scheme.',
    },
    ApiKeyQuery: {
      type: 'apiKey',
      in: 'query',
      name: 'api_key',
      description: 'Example API key passed as a query parameter.',
    },
  },

  swaggerUI: {
    title: 'Orvexa API Explorer',
    persistAuthorization: true,
    docExpansion: 'none',
  },

  // Middleware functions can be added here to protect the docs routes.
  // This empty array exercises the option without assuming a middleware API.
  middlewares: [],

  docs: '/docs',
  json: '/docs/json',

  routes: {
    // AUTHENTICATION

    authRegister: {
      method: 'POST',
      path: '/auth/register',
      summary: 'Register a new account',
      description:
        'Create a user account using a name, email address, and password. The email taken@orvexa.example is reserved to demonstrate the 409 response.',
      tags: ['Authentication'],
      isRequired: true,
      request: {
        body: RegisterSchema,
        contentType: 'application/json',
      },
      response: {
        201: {
          description: 'Account created successfully.',
          schema: UserSchema,
          contentType: 'application/json',
        },
        400: {
          description: 'The supplied registration data is invalid.',
        },
        409: {
          description: 'An account with this email already exists.',
        },
      },
    },

    authLogin: {
      method: 'POST',
      path: '/auth/login',
      summary: 'Log in',
      description:
        'Authenticate a user with email and password. Use demo@orvexa.example / Password123. On success the access_token cookie is set and the tokens are returned.',
      tags: ['Authentication'],
      isRequired: true,
      request: {
        body: LoginSchema,
      },
      response: {
        200: {
          description: 'Authentication succeeded.',
          schema: AuthSessionSchema,
        },
        400: {
          description: 'The request body is invalid.',
        },
        401: {
          description: 'The email or password is incorrect.',
        },
      },
    },

    authLogout: {
      method: 'POST',
      path: '/auth/logout',
      summary: 'Log out',
      description: 'End the current authenticated session and clear the access_token cookie.',
      tags: ['Authentication'],
      isRequired: true,
      security: ['BearerAuth'],
      response: {
        200: {
          description: 'The session was logged out.',
        },
        401: {
          description: 'Authentication is required.',
        },
      },
    },

    authRefresh: {
      method: 'POST',
      path: '/auth/refresh',
      summary: 'Refresh access token',
      description:
        'Exchange a refresh token for a new access token. The demo refresh token is "demo-refresh-token".',
      tags: ['Authentication'],
      isRequired: true,
      request: {
        body: RefreshTokenSchema,
      },
      response: {
        200: {
          description: 'Access token refreshed successfully.',
        },
        400: {
          description: 'The refresh token payload is invalid.',
        },
        401: {
          description: 'The refresh token is invalid or expired.',
        },
      },
    },

    authForgotPassword: {
      method: 'POST',
      path: '/auth/forgot-password',
      summary: 'Request password reset',
      description: 'Request a password reset using the account email address.',
      tags: ['Authentication'],
      isRequired: true,
      request: {
        body: PasswordResetRequestSchema,
      },
      response: {
        200: {
          description: 'The password reset request was accepted.',
        },
        400: {
          description: 'The email address is invalid.',
        },
      },
    },

    authResetPassword: {
      method: 'POST',
      path: '/auth/reset-password',
      summary: 'Reset password',
      description:
        'Set a new password using a valid password reset token. The demo reset token is "demo-reset-token".',
      tags: ['Authentication'],
      isRequired: true,
      request: {
        body: PasswordResetSchema,
      },
      response: {
        200: {
          description: 'Password updated successfully.',
        },
        400: {
          description: 'The reset payload is invalid.',
        },
        401: {
          description: 'The reset token is invalid or expired.',
        },
      },
    },

    // USERS

    getUsers: {
      method: 'GET',
      path: '/users',
      summary: 'Get all users',
      description: 'Retrieve a paginated list of users.',
      tags: ['Users'],
      isRequired: true,
      request: {
        query: PaginationQuerySchema,
      },
      response: {
        200: {
          description: 'Users retrieved successfully.',
          schema: UserSchema,
        },
        400: {
          description: 'The pagination parameters are invalid.',
        },
      },
    },

    getUserById: {
      method: 'GET',
      path: '/users/:id',
      summary: 'Get user by ID',
      description: 'Retrieve one user by their numeric identifier.',
      tags: ['Users'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'User retrieved successfully.',
          schema: UserSchema,
        },
        400: {
          description: 'The user ID is invalid.',
        },
        404: {
          description: 'The user does not exist.',
        },
      },
    },

    createUser: {
      method: 'POST',
      path: '/users',
      summary: 'Create user',
      description: 'Create a user record.',
      tags: ['Users'],
      isRequired: true,
      request: {
        body: CreateUserSchema,
      },
      response: {
        201: {
          description: 'User created successfully.',
          schema: UserSchema,
        },
        400: {
          description: 'The supplied user data is invalid.',
        },
        409: {
          description: 'A user with this email already exists.',
        },
      },
    },

    updateUser: {
      method: 'PATCH',
      path: '/users/:id',
      summary: 'Update user',
      description: 'Update the supplied fields of an existing user.',
      tags: ['Users'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
        body: UpdateUserSchema,
      },
      response: {
        200: {
          description: 'User updated successfully.',
          schema: UserSchema,
        },
        400: {
          description: 'The ID or update data is invalid.',
        },
        404: {
          description: 'The user does not exist.',
        },
      },
    },

    deleteUser: {
      method: 'DELETE',
      path: '/users/:id',
      summary: 'Delete user',
      description: 'Delete a user by their numeric identifier.',
      tags: ['Users'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'User deleted successfully.',
        },
        400: {
          description: 'The user ID is invalid.',
        },
        404: {
          description: 'The user does not exist.',
        },
      },
    },

    // PROFILES

    getMyProfile: {
      method: 'GET',
      path: '/profile',
      summary: 'Get my profile',
      description: 'Retrieve the profile belonging to the authenticated user.',
      tags: ['Profiles'],
      isRequired: true,
      security: ['BearerAuth', 'CookieAuth'],
      response: {
        200: {
          description: 'Profile retrieved successfully.',
          schema: ProfileSchema,
        },
        401: {
          description: 'Authentication is required.',
        },
        404: {
          description: 'Profile not found.',
        },
      },
    },

    getPublicProfile: {
      method: 'GET',
      path: '/profiles/:id',
      summary: 'Get public profile',
      description: 'Retrieve a public profile by its identifier.',
      tags: ['Profiles'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Public profile retrieved successfully.',
          schema: ProfileSchema,
        },
        400: {
          description: 'The profile ID is invalid.',
        },
        404: {
          description: 'Profile not found.',
        },
      },
    },

    updateMyProfile: {
      method: 'PATCH',
      path: '/profile',
      summary: 'Update my profile',
      description: 'Update the display name and biography of the authenticated user.',
      tags: ['Profiles'],
      isRequired: true,
      security: ['BearerAuth', 'CookieAuth'],
      request: {
        body: UpdateProfileSchema,
      },
      response: {
        200: {
          description: 'Profile updated successfully.',
          schema: ProfileSchema,
        },
        400: {
          description: 'The profile data is invalid.',
        },
        401: {
          description: 'Authentication is required.',
        },
      },
    },

    // SERVICES

    getServices: {
      method: 'GET',
      path: '/services',
      summary: 'List services',
      description:
        'Browse services with optional search and pagination parameters. Sortable fields: id, title, price, sellerId.',
      tags: ['Services'],
      isRequired: true,
      request: {
        query: SearchQuerySchema,
      },
      response: {
        200: {
          description: 'Services retrieved successfully.',
          schema: ServiceSchema,
        },
        400: {
          description: 'The query parameters are invalid.',
        },
      },
    },

    getServiceById: {
      method: 'GET',
      path: '/services/:id',
      summary: 'Get service details',
      description: 'Retrieve detailed information about a service.',
      tags: ['Services'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Service retrieved successfully.',
          schema: ServiceSchema,
        },
        400: {
          description: 'The service ID is invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    createService: {
      method: 'POST',
      path: '/services',
      summary: 'Create service',
      description: 'Publish a new service listing.',
      tags: ['Services'],
      isRequired: true,
      security: ['BearerAuth', 'CookieAuth'],
      request: {
        body: CreateServiceSchema,
      },
      response: {
        201: {
          description: 'Service created successfully.',
          schema: ServiceSchema,
        },
        400: {
          description: 'The service data is invalid.',
        },
        401: {
          description: 'Authentication is required.',
        },
      },
    },

    updateService: {
      method: 'PATCH',
      path: '/services/:id',
      summary: 'Update service',
      description: 'Update an existing service listing.',
      tags: ['Services'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
        body: UpdateServiceSchema,
      },
      response: {
        200: {
          description: 'Service updated successfully.',
          schema: ServiceSchema,
        },
        400: {
          description: 'The service data is invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    deleteService: {
      method: 'DELETE',
      path: '/services/:id',
      summary: 'Delete service',
      description: 'Remove a service listing.',
      tags: ['Services'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Service deleted successfully.',
        },
        400: {
          description: 'The service ID is invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    // Exercise HEAD method support.
    headService: {
      method: 'HEAD',
      path: '/services/:id',
      summary: 'Check service resource',
      description:
        'Check whether a service resource is available without returning a response body.',
      tags: ['Services'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'The service resource exists.',
        },
        400: {
          description: 'The service ID is invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    // CARTS

    getCart: {
      method: 'GET',
      path: '/cart',
      summary: 'Get current cart',
      description: 'Retrieve the authenticated user cart and its items.',
      tags: ['Carts'],
      isRequired: true,
      security: ['BearerAuth', 'CookieAuth'],
      response: {
        200: {
          description: 'Cart retrieved successfully.',
        },
        401: {
          description: 'Authentication is required.',
        },
      },
    },

    addCartItem: {
      method: 'POST',
      path: '/cart/items',
      summary: 'Add item to cart',
      description: 'Add a service and quantity to the current user cart.',
      tags: ['Carts'],
      isRequired: true,
      request: {
        body: CartItemSchema,
      },
      response: {
        201: {
          description: 'Item added to cart.',
        },
        400: {
          description: 'The cart item data is invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    removeCartItem: {
      method: 'DELETE',
      path: '/cart/items/:id',
      summary: 'Remove cart item',
      description: 'Remove an item from the current user cart.',
      tags: ['Carts'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Cart item removed successfully.',
        },
        400: {
          description: 'The cart item ID is invalid.',
        },
        404: {
          description: 'Cart item not found.',
        },
      },
    },

    // ORDERS

    getOrders: {
      method: 'GET',
      path: '/orders',
      summary: 'List orders',
      description:
        'Retrieve orders associated with the authenticated user. Search matches the order status.',
      tags: ['Orders'],
      isRequired: true,
      request: {
        query: SearchQuerySchema,
      },
      response: {
        200: {
          description: 'Orders retrieved successfully.',
          schema: OrderSchema,
        },
        400: {
          description: 'The query parameters are invalid.',
        },
      },
    },

    getOrderById: {
      method: 'GET',
      path: '/orders/:id',
      summary: 'Get order details',
      description: 'Retrieve one order by ID.',
      tags: ['Orders'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Order retrieved successfully.',
          schema: OrderSchema,
        },
        400: {
          description: 'The order ID is invalid.',
        },
        404: {
          description: 'Order not found.',
        },
      },
    },

    createOrder: {
      method: 'POST',
      path: '/orders',
      summary: 'Create order',
      description: 'Create an order for a service.',
      tags: ['Orders'],
      isRequired: true,
      request: {
        body: CreateOrderSchema,
      },
      response: {
        201: {
          description: 'Order created successfully.',
          schema: OrderSchema,
        },
        400: {
          description: 'The order data is invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    // CONTRACTS

    getContracts: {
      method: 'GET',
      path: '/contracts',
      summary: 'List contracts',
      description: 'Retrieve contracts visible to the authenticated user.',
      tags: ['Contracts'],
      isRequired: true,
      request: {
        query: PaginationQuerySchema,
      },
      response: {
        200: {
          description: 'Contracts retrieved successfully.',
          schema: ContractSchema,
        },
        400: {
          description: 'The pagination parameters are invalid.',
        },
      },
    },

    getContractById: {
      method: 'GET',
      path: '/contracts/:id',
      summary: 'Get contract details',
      description: 'Retrieve a contract by ID.',
      tags: ['Contracts'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Contract retrieved successfully.',
          schema: ContractSchema,
        },
        400: {
          description: 'The contract ID is invalid.',
        },
        404: {
          description: 'Contract not found.',
        },
      },
    },

    acceptContract: {
      method: 'POST',
      path: '/contracts/:id/accept',
      summary: 'Accept contract',
      description:
        'Accept a pending contract. Contract 1 is pending in the demo data; contract 2 is already accepted.',
      tags: ['Contracts'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Contract accepted successfully.',
          schema: ContractSchema,
        },
        400: {
          description: 'The contract cannot be accepted in its current state.',
        },
        404: {
          description: 'Contract not found.',
        },
      },
    },

    // MESSAGES

    getMessages: {
      method: 'GET',
      path: '/conversations/:id/messages',
      summary: 'Get conversation messages',
      description:
        'Retrieve messages belonging to a conversation. Conversation 1 exists in the demo data.',
      tags: ['Messages'],
      isRequired: true,
      security: ['BearerAuth'],
      request: {
        params: IdParamsSchema,
        query: PaginationQuerySchema,
      },
      response: {
        200: {
          description: 'Messages retrieved successfully.',
          schema: MessageSchema,
        },
        400: {
          description: 'The conversation ID or pagination parameters are invalid.',
        },
        401: {
          description: 'Authentication is required.',
        },
        404: {
          description: 'Conversation not found.',
        },
      },
    },

    sendMessage: {
      method: 'POST',
      path: '/messages',
      summary: 'Send message',
      description: 'Send a message to a conversation.',
      tags: ['Messages'],
      isRequired: true,
      security: ['BearerAuth'],
      request: {
        body: SendMessageSchema,
      },
      response: {
        201: {
          description: 'Message sent successfully.',
          schema: MessageSchema,
        },
        400: {
          description: 'The message data is invalid.',
        },
        401: {
          description: 'Authentication is required.',
        },
        404: {
          description: 'Conversation not found.',
        },
      },
    },

    // NOTIFICATIONS

    getNotifications: {
      method: 'GET',
      path: '/notifications',
      summary: 'List notifications',
      description: 'Retrieve notifications for the authenticated user.',
      tags: ['Notifications'],
      isRequired: true,
      request: {
        query: PaginationQuerySchema,
      },
      response: {
        200: {
          description: 'Notifications retrieved successfully.',
          schema: NotificationSchema,
        },
        400: {
          description: 'The pagination parameters are invalid.',
        },
      },
    },

    markNotificationRead: {
      method: 'PATCH',
      path: '/notifications/:id/read',
      summary: 'Mark notification as read',
      description: 'Mark one notification as read.',
      tags: ['Notifications'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Notification marked as read.',
          schema: NotificationSchema,
        },
        400: {
          description: 'The notification ID is invalid.',
        },
        404: {
          description: 'Notification not found.',
        },
      },
    },

    // REVIEWS

    getServiceReviews: {
      method: 'GET',
      path: '/services/:id/reviews',
      summary: 'Get service reviews',
      description: 'Retrieve reviews associated with a service.',
      tags: ['Reviews'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
        query: PaginationQuerySchema,
      },
      response: {
        200: {
          description: 'Reviews retrieved successfully.',
          schema: ReviewSchema,
        },
        400: {
          description: 'The service ID or pagination parameters are invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    createReview: {
      method: 'POST',
      path: '/reviews',
      summary: 'Create review',
      description: 'Create a review for a service. The rating must be between 1 and 5.',
      tags: ['Reviews'],
      isRequired: true,
      request: {
        body: CreateReviewSchema,
      },
      response: {
        201: {
          description: 'Review created successfully.',
          schema: ReviewSchema,
        },
        400: {
          description: 'The review data is invalid.',
        },
        404: {
          description: 'Service not found.',
        },
      },
    },

    // PAYMENTS

    getPaymentById: {
      method: 'GET',
      path: '/payments/:id',
      summary: 'Get payment details',
      description: 'Retrieve payment information by ID.',
      tags: ['Payments'],
      isRequired: true,
      request: {
        params: IdParamsSchema,
      },
      response: {
        200: {
          description: 'Payment retrieved successfully.',
          schema: PaymentSchema,
        },
        400: {
          description: 'The payment ID is invalid.',
        },
        404: {
          description: 'Payment not found.',
        },
      },
    },

    createPayment: {
      method: 'POST',
      path: '/payments',
      summary: 'Create payment',
      description: 'Create a payment operation for an order. The amount must be greater than zero.',
      tags: ['Payments'],
      isRequired: true,
      request: {
        body: CreatePaymentSchema,
      },
      response: {
        201: {
          description: 'Payment operation created.',
          schema: PaymentSchema,
        },
        400: {
          description: 'The payment data is invalid.',
        },
        404: {
          description: 'Order not found.',
        },
      },
    },

    // PLATFORM WALLETS

    getMyWallet: {
      method: 'GET',
      path: '/wallet',
      summary: 'Get my wallet',
      description: 'Retrieve the authenticated user wallet and current balance.',
      tags: ['Platform Wallets'],
      isRequired: true,
      security: ['BearerAuth', 'CookieAuth'],
      response: {
        200: {
          description: 'Wallet retrieved successfully.',
          schema: WalletSchema,
        },
        401: {
          description: 'Authentication is required.',
        },
      },
    },

    getWalletTransactions: {
      method: 'GET',
      path: '/wallet/transactions',
      summary: 'Get wallet transactions',
      description: 'Retrieve transaction history for the authenticated user wallet.',
      tags: ['Platform Wallets'],
      isRequired: true,
      request: {
        query: PaginationQuerySchema,
      },
      response: {
        200: {
          description: 'Wallet transactions retrieved successfully.',
        },
        400: {
          description: 'The pagination parameters are invalid.',
        },
      },
    },

    // FILE UPLOADS

    uploadAsset: {
      method: 'POST',
      path: '/uploads',
      summary: 'Upload an asset',
      description:
        'Example multipart upload operation. Send a "file" part (up to 5 MB) and an optional "folder" text part. The request schema documents upload metadata; the binary file field itself is not expressible with the currently supplied RiserBob schema subset. The file is inspected but not stored.',
      tags: ['Uploads'],
      isRequired: true,
      request: {
        body: UploadMetadataSchema,
        contentType: 'multipart/form-data',
      },
      response: {
        201: {
          description: 'Asset uploaded successfully.',
        },
        400: {
          description: 'The upload request is invalid.',
        },
        413: {
          description: 'The uploaded file is too large.',
        },
      },
    },

    // EXERCISE OTHER SUPPORTED OPTIONS

    legacySearch: {
      method: 'GET',
      path: '/legacy/search',
      summary: 'Legacy search endpoint',
      description: 'Example deprecated endpoint, retained to exercise the deprecated option.',
      tags: ['Utilities'],
      deprecated: true,
      isRequired: true,
      request: {
        query: SearchQuerySchema,
        headers: LegacyHeadersSchema,
      },
      response: {
        200: {
          description: 'Legacy search completed.',
        },
        400: {
          description: 'The query parameters or headers are invalid.',
        },
      },
    },

    apiKeyStatus: {
      method: 'GET',
      path: '/utilities/api-key-status',
      summary: 'Check API key status',
      description:
        'Example endpoint documenting query-based API key security. Use ?api_key=demo-key.',
      tags: ['Utilities'],
      isRequired: true,
      security: ['ApiKeyQuery'],
      response: {
        200: {
          description: 'API key accepted.',
        },
        401: {
          description: 'API key is missing or invalid.',
        },
      },
    },

    apiKeyHeaderStatus: {
      method: 'GET',
      path: '/utilities/api-key-header-status',
      summary: 'Check header API key status',
      description:
        'Example endpoint documenting header-based API key security. Send X-API-Key: demo-key.',
      tags: ['Utilities'],
      isRequired: true,
      security: ['ApiKeyHeader'],
      response: {
        200: {
          description: 'API key accepted.',
        },
        401: {
          description: 'API key is missing or invalid.',
        },
      },
    },

    cookieSession: {
      method: 'GET',
      path: '/utilities/cookie-session',
      summary: 'Check cookie session',
      description:
        'Example endpoint documenting cookie-based authentication. Log in first, or send Cookie: access_token=demo-access-token.',
      tags: ['Utilities'],
      isRequired: true,
      security: ['CookieAuth'],
      response: {
        200: {
          description: 'Cookie session is valid.',
        },
        401: {
          description: 'Cookie session is missing or invalid.',
        },
      },
    },
  },
})

// Route handlers

// Authentication

bob.spongPost(
  '/auth/register',
  handle<Rec, Rec, { name: string; email: string; password: string }>(
    { body: RegisterSchema },
    ({ body }, _spongReq, spongRes) => {
      if (body.email.toLowerCase() === TAKEN_EMAIL) {
        return spongRes.SpongConflict({ message: 'An account with this email already exists.' })
      }
      return spongRes.SpongCreated({ id: nextSampleId(), name: body.name, email: body.email })
    },
  ),
)

bob.spongPost(
  '/auth/login',
  handle<Rec, Rec, { email: string; password: string }>(
    { body: LoginSchema },
    ({ body }, _spongReq, spongRes) => {
      if (body.email.toLowerCase() !== DEMO_LOGIN.email || body.password !== DEMO_LOGIN.password) {
        return spongRes.SpongUnauthorized({ message: 'The email or password is incorrect.' })
      }
      return spongRes
        .header(
          'Set-Cookie',
          `access_token=${DEMO_ACCESS_TOKEN}; HttpOnly; Path=/; SameSite=Lax; Max-Age=900`,
        )
        .SpongOK({
          id: 1,
          name: 'Demo User',
          email: DEMO_LOGIN.email,
          accessToken: DEMO_ACCESS_TOKEN,
          refreshToken: DEMO_REFRESH_TOKEN,
        })
    },
  ),
)

bob.spongPost('/auth/logout', (spongReq, spongRes) => {
  if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
  return spongRes
    .header('Set-Cookie', 'access_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
    .SpongOK({ message: 'You have been logged out.' })
})

bob.spongPost(
  '/auth/refresh',
  handle<Rec, Rec, { refreshToken: string }>(
    { body: RefreshTokenSchema },
    ({ body }, _spongReq, spongRes) => {
      if (body.refreshToken !== DEMO_REFRESH_TOKEN) {
        return spongRes.SpongUnauthorized({ message: 'The refresh token is invalid or expired.' })
      }
      return spongRes.SpongOK({ accessToken: DEMO_ACCESS_TOKEN })
    },
  ),
)

bob.spongPost(
  '/auth/forgot-password',
  handle({ body: PasswordResetRequestSchema }, (_ctx, _spongReq, spongRes) =>
    // Always the same answer, so the response never reveals whether an account exists.
    spongRes.SpongOK({ message: 'If the account exists, a reset link has been sent.' }),
  ),
)

bob.spongPost(
  '/auth/reset-password',
  handle<Rec, Rec, { token: string; password: string }>(
    { body: PasswordResetSchema },
    ({ body }, _spongReq, spongRes) => {
      if (body.token !== DEMO_RESET_TOKEN) {
        return spongRes.SpongUnauthorized({ message: 'The reset token is invalid or expired.' })
      }
      return spongRes.SpongOK({ message: 'Password updated successfully.' })
    },
  ),
)

// Users

bob.spongGet(
  '/users',
  handle<Rec, ListQuery>({ query: PaginationQuerySchema }, ({ query }, _spongReq, spongRes) =>
    listResponse(spongRes, users, query),
  ),
)

bob.spongGet(
  '/users/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const user = findById(users, params.id)
    return user
      ? spongRes.SpongOK(user)
      : spongRes.SpongNotFound({ message: 'The user does not exist.' })
  }),
)

bob.spongPost(
  '/users',
  handle<Rec, Rec, { name: string; email: string }>(
    { body: CreateUserSchema },
    ({ body }, _spongReq, spongRes) => {
      if (users.some((user) => user.email === body.email.toLowerCase())) {
        return spongRes.SpongConflict({ message: 'A user with this email already exists.' })
      }
      return spongRes.SpongCreated({ id: nextSampleId(), name: body.name, email: body.email })
    },
  ),
)

bob.spongPatch(
  '/users/:id',
  handle<{ id: number }, Rec, { name?: string | null; email?: string | null }>(
    { params: IdParamsSchema, body: UpdateUserSchema },
    ({ params, body }, _spongReq, spongRes) => {
      const user = findById(users, params.id)
      if (!user) return spongRes.SpongNotFound({ message: 'The user does not exist.' })
      return spongRes.SpongOK({
        ...user,
        ...(body.name ? { name: body.name } : {}),
        ...(body.email ? { email: body.email } : {}),
      })
    },
  ),
)

bob.spongDelete(
  '/users/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _req, res) =>
    findById(users, params.id)
      ? res.SpongOK({ message: 'User deleted successfully.' })
      : res.SpongNotFound({ message: 'The user does not exist.' }),
  ),
)

//Profiles

bob.spongGet('/profile', (spongReq, spongRes) => {
  if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
  return spongRes.SpongOK(profiles[0])
})

bob.spongGet(
  '/profiles/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const profile = findById(profiles, params.id)
    return profile
      ? spongRes.SpongOK(profile)
      : spongRes.SpongNotFound({ message: 'Profile not found.' })
  }),
)

bob.spongPatch(
  '/profile',
  handle<Rec, Rec, { displayName?: string | null; bio?: string | null }>(
    { body: UpdateProfileSchema },
    ({ body }, spongReq, spongRes) => {
      if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
      return spongRes.SpongOK({
        ...profiles[0],
        ...(body.displayName ? { displayName: body.displayName } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
      })
    },
  ),
)

// Services

bob.spongGet(
  '/services',
  handle<Rec, ListQuery>({ query: SearchQuerySchema }, ({ query }, _spongReq, spongRes) =>
    listResponse(spongRes, services, query, ['title', 'description']),
  ),
)

bob.spongGet(
  '/services/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const service = findById(services, params.id)
    return service
      ? spongRes.SpongOK(service)
      : spongRes.SpongNotFound({ message: 'Service not found.' })
  }),
)

bob.spongPost(
  '/services',
  handle<Rec, Rec, { title: string; description: string; price: number }>(
    { body: CreateServiceSchema },
    ({ body }, spongReq, spongRes) => {
      if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
      if (body.price <= 0) {
        return spongRes.SpongBadRequest({ message: 'The price must be greater than zero.' })
      }
      return spongRes.SpongCreated({ id: nextSampleId(), ...body, sellerId: 1 })
    },
  ),
)

bob.spongPatch(
  '/services/:id',
  handle<
    { id: number },
    Rec,
    { title?: string | null; description?: string | null; price?: number | null }
  >(
    { params: IdParamsSchema, body: UpdateServiceSchema },
    ({ params, body }, _spongReq, spongRes) => {
      const service = findById(services, params.id)
      if (!service) return spongRes.SpongNotFound({ message: 'Service not found.' })
      if (body.price != null && body.price <= 0) {
        return spongRes.SpongBadRequest({ message: 'The price must be greater than zero.' })
      }
      return spongRes.SpongOK({
        ...service,
        ...(body.title ? { title: body.title } : {}),
        ...(body.description ? { description: body.description } : {}),
        ...(body.price != null ? { price: body.price } : {}),
      })
    },
  ),
)

bob.spongDelete(
  '/services/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) =>
    findById(services, params.id)
      ? spongRes.SpongOK({ message: 'Service deleted successfully.' })
      : spongRes.SpongNotFound({ message: 'Service not found.' }),
  ),
)

bob.spongHead(
  '/services/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }) => {
    const service = findById(services, params.id)
    return service
      ? new Response(null, { status: 200, headers: { 'X-Service-Id': String(service.id) } })
      : new Response(null, { status: 404 })
  }),
)

// Carts

bob.spongGet('/cart', (spongReq, spongRes) => {
  if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
  const total = cart.items.reduce((sum, item) => {
    const service = findById(services, item.serviceId)
    return sum + (service ? service.price * item.quantity : 0)
  }, 0)
  return spongRes.SpongOK({ items: cart.items, total, currency: 'USD' })
})

bob.spongPost(
  '/cart/items',
  handle<Rec, Rec, { serviceId: number; quantity: number }>(
    { body: CartItemSchema },
    ({ body }, _spongReq, spongRes) => {
      if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100) {
        return spongRes.SpongBadRequest({
          message: 'The quantity must be an integer from 1 to 100.',
        })
      }
      if (!findById(services, body.serviceId)) {
        return spongRes.SpongNotFound({ message: 'Service not found.' })
      }
      return spongRes.SpongCreated({ id: nextSampleId(), ...body })
    },
  ),
)

bob.spongDelete(
  '/cart/items/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) =>
    findById(cart.items, params.id)
      ? spongRes.SpongOK({ message: 'Cart item removed successfully.' })
      : spongRes.SpongNotFound({ message: 'Cart item not found.' }),
  ),
)

// Orders

bob.spongGet(
  '/orders',
  handle<Rec, ListQuery>({ query: SearchQuerySchema }, ({ query }, _spongReq, spongRes) =>
    listResponse(spongRes, orders, query, ['status']),
  ),
)

bob.spongGet(
  '/orders/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const order = findById(orders, params.id)
    return order ? spongRes.SpongOK(order) : spongRes.SpongNotFound({ message: 'Order not found.' })
  }),
)

bob.spongPost(
  '/orders',
  handle<Rec, Rec, { serviceId: number; quantity: number }>(
    { body: CreateOrderSchema },
    ({ body }, _spongReq, res) => {
      if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100) {
        return res.SpongBadRequest({ message: 'The quantity must be an integer from 1 to 100.' })
      }
      if (!findById(services, body.serviceId)) {
        return res.SpongNotFound({ message: 'Service not found.' })
      }
      return res.SpongCreated({
        id: nextSampleId(),
        buyerId: 3,
        serviceId: body.serviceId,
        status: 'pending',
      })
    },
  ),
)

// Contracts

bob.spongGet(
  '/contracts',
  handle<Rec, ListQuery>({ query: PaginationQuerySchema }, ({ query }, _spongReq, spongRes) =>
    listResponse(spongRes, contracts, query),
  ),
)

bob.spongGet(
  '/contracts/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const contract = findById(contracts, params.id)
    return contract
      ? spongRes.SpongOK(contract)
      : spongRes.SpongNotFound({ message: 'Contract not found.' })
  }),
)

bob.spongPost(
  '/contracts/:id/accept',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const contract = findById(contracts, params.id)
    if (!contract) return spongRes.SpongNotFound({ message: 'Contract not found.' })
    if (contract.status !== 'pending') {
      return spongRes.SpongBadRequest({
        message: 'The contract cannot be accepted in its current state.',
      })
    }
    return spongRes.SpongOK({ ...contract, status: 'accepted' })
  }),
)

// Messages

bob.spongGet(
  '/conversations/:id/messages',
  handle<{ id: number }, ListQuery>(
    { params: IdParamsSchema, query: PaginationQuerySchema },
    ({ params, query }, spongReq, spongRes) => {
      if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
      const conversation = messages.filter((message) => message.conversationId === params.id)
      if (conversation.length === 0) {
        return spongRes.SpongNotFound({ message: 'Conversation not found.' })
      }
      return listResponse(spongRes, conversation, query)
    },
  ),
)

bob.spongPost(
  '/messages',
  handle<Rec, Rec, { conversationId: number; content: string }>(
    { body: SendMessageSchema },
    ({ body }, spongReq, spongRes) => {
      if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
      if (body.content.trim().length === 0) {
        return spongRes.SpongBadRequest({ message: 'The message content cannot be empty.' })
      }
      if (!messages.some((message) => message.conversationId === body.conversationId)) {
        return spongRes.SpongNotFound({ message: 'Conversation not found.' })
      }
      return spongRes.SpongCreated({
        id: nextSampleId(),
        conversationId: body.conversationId,
        senderId: 1,
        content: body.content,
      })
    },
  ),
)

//Notifications

bob.spongGet(
  '/notifications',
  handle<Rec, ListQuery>({ query: PaginationQuerySchema }, ({ query }, _spongReq, spongRes) =>
    listResponse(spongRes, notifications, query),
  ),
)

bob.spongPatch(
  '/notifications/:id/read',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const notification = findById(notifications, params.id)
    return notification
      ? spongRes.SpongOK({ ...notification, isRead: true })
      : spongRes.SpongNotFound({ message: 'Notification not found.' })
  }),
)

// ---- Reviews ----------------------------------------------------------------

bob.spongGet(
  '/services/:id/reviews',
  handle<{ id: number }, ListQuery>(
    { params: IdParamsSchema, query: PaginationQuerySchema },
    ({ params, query }, _spongReq, spongRes) => {
      if (!findById(services, params.id)) {
        return spongRes.SpongNotFound({ message: 'Service not found.' })
      }
      return listResponse(
        spongRes,
        reviews.filter((review) => review.serviceId === params.id),
        query,
      )
    },
  ),
)

bob.spongPost(
  '/reviews',
  handle<Rec, Rec, { serviceId: number; rating: number; comment?: string | null }>(
    { body: CreateReviewSchema },
    ({ body }, _spongReq, spongRes) => {
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
        return spongRes.SpongBadRequest({ message: 'The rating must be an integer from 1 to 5.' })
      }
      if (!findById(services, body.serviceId)) {
        return spongRes.SpongNotFound({ message: 'Service not found.' })
      }
      return spongRes.SpongCreated({
        id: nextSampleId(),
        serviceId: body.serviceId,
        rating: body.rating,
        comment: body.comment ?? null,
      })
    },
  ),
)

//  Payments

bob.spongGet(
  '/payments/:id',
  handle<{ id: number }>({ params: IdParamsSchema }, ({ params }, _spongReq, spongRes) => {
    const payment = findById(payments, params.id)
    return payment
      ? spongRes.SpongOK(payment)
      : spongRes.SpongNotFound({ message: 'Payment not found.' })
  }),
)

bob.spongPost(
  '/payments',
  handle<Rec, Rec, { orderId: number; amount: number }>(
    { body: CreatePaymentSchema },
    ({ body }, _spongReq, spongRes) => {
      if (body.amount <= 0) {
        return spongRes.SpongBadRequest({ message: 'The amount must be greater than zero.' })
      }
      if (!findById(orders, body.orderId)) {
        return spongRes.SpongNotFound({ message: 'Order not found.' })
      }
      return spongRes.SpongCreated({
        id: nextSampleId(),
        orderId: body.orderId,
        amount: body.amount,
        status: 'pending',
      })
    },
  ),
)

//  Platform wallets

bob.spongGet('/wallet', (spongReq, spongRes) => {
  if (!hasDemoAuth(spongReq)) return spongRes.SpongUnauthorized(unauthorizedBody)
  return spongRes.SpongOK(wallet)
})

bob.spongGet(
  '/wallet/transactions',
  handle<Rec, ListQuery>({ query: PaginationQuerySchema }, ({ query }, _req, res) =>
    listResponse(res, walletTransactions, query),
  ),
)

//  File uploads

bob.spongPost('/uploads', async (spongReq, spongRes) => {
  const contentType = spongReq.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return spongRes.SpongBadRequest({ message: 'The request must be multipart/form-data.' })
  }

  let form: {
    get: (name: string) => FormDataEntryValue | null
  }
  try {
    form = await spongReq.formData()
  } catch {
    return spongRes.SpongBadRequest({ message: 'The multipart body could not be read.' })
  }

  const rawFolder = form.get('folder')
  const metadata = Validator.validate<{ folder?: string | null }>(
    typeof rawFolder === 'string' && rawFolder !== '' ? { folder: rawFolder } : {},
    UploadMetadataSchema,
  )
  if (!metadata.valid) {
    return spongRes.SpongBadRequest({
      message: 'Invalid upload metadata.',
      errors: metadata.errors,
    })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return spongRes.SpongBadRequest({ message: 'A "file" part is required.' })
  }
  if (file.size === 0) {
    return spongRes.SpongBadRequest({ message: 'The uploaded file is empty.' })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return spongRes.SpongContentTooLarge({ message: 'The uploaded file is too large (max 5 MB).' })
  }

  return spongRes.SpongCreated({
    id: nextSampleId(),
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    folder: metadata.data.folder ?? null,
  })
})

//  Utilities

bob.spongGet(
  '/legacy/search',
  handle<Rec, ListQuery>({ query: SearchQuerySchema }, ({ query }, spongReq, spongRes) => {
    const clientVersion = spongReq.headers.get('x-client-version')
    const headers = Validator.validate(
      clientVersion ? { 'x-client-version': clientVersion } : {},
      LegacyHeadersSchema,
    )
    if (!headers.valid) {
      return spongRes.SpongBadRequest({ message: 'Invalid headers.', errors: headers.errors })
    }
    return spongRes.header('Deprecation', 'true').SpongOK({
      deprecated: true,
      clientVersion: clientVersion ?? null,
      results: services
        .filter((service) =>
          query.search ? service.title.toLowerCase().includes(query.search.toLowerCase()) : true,
        )
        .map(({ id, title }) => ({ id, title })),
    })
  }),
)

bob.spongGet('/utilities/api-key-status', (spongReq, spongRes) =>
  spongReq.query.get('api_key') === DEMO_API_KEY
    ? spongRes.SpongOK({ status: 'valid', scheme: 'ApiKeyQuery' })
    : spongRes.SpongUnauthorized({ message: 'API key is missing or invalid.' }),
)

bob.spongGet('/utilities/api-key-header-status', (spongReq, spongRes) =>
  spongReq.headers.get('x-api-key') === DEMO_API_KEY
    ? spongRes.SpongOK({ status: 'valid', scheme: 'ApiKeyHeader' })
    : spongRes.SpongUnauthorized({ message: 'API key is missing or invalid.' }),
)

bob.spongGet('/utilities/cookie-session', (spongReq, spongRes) =>
  getCookie(spongReq, 'access_token') === DEMO_ACCESS_TOKEN
    ? spongRes.SpongOK({ status: 'valid', scheme: 'CookieAuth' })
    : spongRes.SpongUnauthorized({ message: 'Cookie session is missing or invalid.' }),
)

// Setup and start

// Every documented route is marked isRequired: true because each one has a real
// handler registered above. If a route is documented without a handler (or the
// method/path pair differs), strict validation will report it at startup.

openapi.setup(bob)

bob.spongListen(4000, () => {
  console.log('Orvexa OpenAPI showcase running at http://localhost:4000')
  console.log('Swagger UI: http://localhost:4000/docs')
  console.log('OpenAPI JSON: http://localhost:4000/docs/json')
})
