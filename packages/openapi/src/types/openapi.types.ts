import type { JsonSchema } from './schema.types.js'

export interface OpenAPIInfo {
  title: string
  version: string
  description?: string
  termsOfService?: string
  contact?: {
    name?: string
    email?: string
    url?: string
  }
  license?: {
    name: string
    url?: string
  }
}

export interface OpenAPIServer {
  /** Absolute http(s) URL or a path starting with `/`. */
  url: string
  description?: string
}

export type OpenAPISecurityScheme =
  | {
      type: 'http'
      scheme: 'bearer'
      /** e.g. `JWT`. */
      bearerFormat?: string
      description?: string
    }
  | {
      /** Also used for cookie authentication (`in: 'cookie'`). */
      type: 'apiKey'
      in: 'header' | 'query' | 'cookie'
      name: string
      description?: string
    }

// ---------------------------------------------------------------------------
// Generated document (OpenAPI Specification 3.1.0)
// ---------------------------------------------------------------------------

export interface OpenAPIMediaType {
  schema: JsonSchema
}

export interface OpenAPIParameter {
  name: string
  in: 'path' | 'query' | 'header'
  required: boolean
  schema: JsonSchema
}

export interface OpenAPIRequestBody {
  required: boolean
  content: Record<string, OpenAPIMediaType>
}

export interface OpenAPIResponseObject {
  description: string
  content?: Record<string, OpenAPIMediaType>
}

export interface OpenAPIOperation {
  summary?: string
  description?: string
  tags?: string[]
  operationId: string
  deprecated?: true
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
  responses: Record<string, OpenAPIResponseObject>
  security?: Record<string, string[]>[]
}

export type OpenAPIPathItem = Partial<
  Record<'get' | 'post' | 'put' | 'patch' | 'delete' | 'head', OpenAPIOperation>
>

export interface OpenAPIDocument {
  openapi: '3.1.0'
  info: OpenAPIInfo
  servers?: OpenAPIServer[]
  paths: Record<string, OpenAPIPathItem>
  components?: {
    securitySchemes: Record<string, OpenAPISecurityScheme>
  }
}
