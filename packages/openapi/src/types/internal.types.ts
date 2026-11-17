import type { SpongMiddleware, SpongRequest } from 'riser-bob'
import type { OpenAPIInfo, OpenAPISecurityScheme, OpenAPIServer } from './openapi.types.js'
import type { OpenAPIMethod } from './route.types.js'
import type { ConvertedSchema } from './schema.types.js'

/** Internal (not exported from the package entry point). */
export interface ResolvedResponse {
  readonly status: number
  readonly description: string
  readonly schema?: ConvertedSchema
  readonly contentType: string
}

export interface ResolvedRoute {
  /** Documentation key (becomes the `operationId`). */
  readonly key: string
  readonly method: OpenAPIMethod
  /** OpenAPI style, normalized (`/users/{id}`). */
  readonly path: string
  /** Same shape, parameter names erased (`/users/{}`). */
  readonly shape: string
  readonly pathParams: readonly string[]
  readonly summary?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly deprecated: boolean
  readonly isRequired: boolean
  readonly security: readonly string[]
  readonly body?: { readonly schema: ConvertedSchema; readonly contentType: string }
  readonly query?: ConvertedSchema
  readonly params?: ConvertedSchema
  readonly headers?: ConvertedSchema
  readonly responses: readonly ResolvedResponse[]
}

export interface ResolvedSwaggerUI {
  readonly title: string
  readonly persistAuthorization: boolean
  readonly docExpansion: 'list' | 'full' | 'none'
}

export interface ResolvedOptions {
  readonly info: OpenAPIInfo
  readonly servers: readonly OpenAPIServer[]
  readonly securitySchemes: Readonly<Record<string, OpenAPISecurityScheme>>
  /** Normalized static path, or `undefined` when disabled. */
  readonly docsPath: string | undefined
  readonly jsonPath: string | undefined
  readonly middlewares: readonly SpongMiddleware<SpongRequest>[]
  readonly swaggerUI: ResolvedSwaggerUI
  readonly routes: readonly ResolvedRoute[]
}
