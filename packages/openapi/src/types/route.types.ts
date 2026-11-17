import type { SpongMiddleware, SpongRequest } from 'riser-bob'
import type { OpenAPIInfo, OpenAPIServer, OpenAPISecurityScheme } from './openapi.types.js'
import type { RiserBobSchema } from './schema.types.js'

/**
 * HTTP methods that can be documented.
 *
 * `OPTIONS` is intentionally absent: RiserBob's HTTP server answers every
 * `OPTIONS` request (CORS preflight) before it reaches the router, so a
 * registered `OPTIONS` route can never be reached and must not be documented.
 */
export type OpenAPIMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

/** Body encodings RiserBob can read (`json()` and `formData()`). */
export type OpenAPIBodyContentType =
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'multipart/form-data'

export interface OpenAPIRequest {
  body?: RiserBobSchema
  /** Defaults to `application/json`. */
  contentType?: OpenAPIBodyContentType
  query?: RiserBobSchema
  params?: RiserBobSchema
  headers?: RiserBobSchema
}

export interface OpenAPIResponse {
  description: string
  schema?: RiserBobSchema
  /** Media type of `schema`. Defaults to `application/json`. */
  contentType?: string
}

export type OpenAPIResponses = Record<number, OpenAPIResponse>

export interface OpenAPIRoute {
  method: OpenAPIMethod
  /** RiserBob style (`/users/:id`) or OpenAPI style (`/users/{id}`). */
  path: string
  summary?: string
  description?: string
  tags?: string[]
  /** Defaults to `true`: the route must be registered in RiserBob. */
  isRequired?: boolean
  deprecated?: boolean
  request?: OpenAPIRequest
  response: OpenAPIResponses
  /** Names of entries of `securitySchemes`. Each name is an alternative (OR). */
  security?: string[]
}

export interface SwaggerUIOptions {
  /** HTML title of the documentation page. Defaults to `info.title`. */
  title?: string
  persistAuthorization?: boolean
  docExpansion?: 'list' | 'full' | 'none'
}

export interface OpenAPIOptions {
  info: OpenAPIInfo
  /** Swagger UI path, `false` to disable it. Defaults to `/docs`. */
  docs?: string | false
  /** OpenAPI JSON path, `false` to disable it. Defaults to `/docs/json`. */
  json?: string | false
  routes: Record<string, OpenAPIRoute>
  servers?: OpenAPIServer[]
  securitySchemes?: Record<string, OpenAPISecurityScheme>
  /**
   * RiserBob middlewares applied to the documentation routes only
   * (e.g. an authentication middleware to keep the docs private).
   */
  middlewares?: SpongMiddleware<SpongRequest>[]
  swaggerUI?: SwaggerUIOptions
}
