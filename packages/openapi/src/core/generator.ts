import type {
  OpenAPIDocument,
  OpenAPIInfo,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIPathItem,
  OpenAPIRequestBody,
  OpenAPIResponseObject,
  OpenAPISecurityScheme,
  OpenAPIServer,
} from '../types/openapi.types.js'
import type { ResolvedRoute } from '../types/internal.types.js'
import type { ConvertedSchema } from '../types/schema.types.js'

export interface GeneratorInput {
  readonly info: OpenAPIInfo
  readonly servers: readonly OpenAPIServer[]
  readonly securitySchemes: Readonly<Record<string, OpenAPISecurityScheme>>
  /** Routes that exist in RiserBob (already filtered by strict validation). */
  readonly routes: readonly ResolvedRoute[]
}

type PathItemKey = keyof OpenAPIPathItem

function methodKey(method: ResolvedRoute['method']): PathItemKey {
  switch (method) {
    case 'GET':
      return 'get'
    case 'POST':
      return 'post'
    case 'PUT':
      return 'put'
    case 'PATCH':
      return 'patch'
    case 'DELETE':
      return 'delete'
    case 'HEAD':
      return 'head'
  }
}

function toParameters(
  schema: ConvertedSchema,
  location: OpenAPIParameter['in'],
): OpenAPIParameter[] {
  return schema.fields.map((field) => ({
    name: field.name,
    in: location,
    required: location === 'path' ? true : field.required,
    schema: field.schema,
  }))
}

function buildParameters(route: ResolvedRoute): OpenAPIParameter[] {
  const declared = new Map(route.params?.fields.map((field) => [field.name, field]) ?? [])

  // Path parameters are always extracted from the path (never duplicated).
  const pathParameters: OpenAPIParameter[] = route.pathParams.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: declared.get(name)?.schema ?? { type: 'string' },
  }))

  return [
    ...pathParameters,
    ...(route.query ? toParameters(route.query, 'query') : []),
    ...(route.headers ? toParameters(route.headers, 'header') : []),
  ]
}

function buildOperation(route: ResolvedRoute): OpenAPIOperation {
  const responses: Record<string, OpenAPIResponseObject> = {}
  for (const response of route.responses) {
    responses[String(response.status)] = response.schema
      ? {
          description: response.description,
          content: { [response.contentType]: { schema: response.schema.objectSchema } },
        }
      : { description: response.description }
  }

  const parameters = buildParameters(route)

  // Built in reading order: summary, description, tags, operationId, ... responses, security.
  const operation: OpenAPIOperation = {
    ...(route.summary === undefined ? {} : { summary: route.summary }),
    ...(route.description === undefined ? {} : { description: route.description }),
    ...(route.tags !== undefined && route.tags.length > 0 ? { tags: [...route.tags] } : {}),
    operationId: route.key,
    ...(route.deprecated ? { deprecated: true as const } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(route.body
      ? {
          requestBody: {
            required: route.body.schema.fields.some((field) => field.required),
            content: { [route.body.contentType]: { schema: route.body.schema.objectSchema } },
          } satisfies OpenAPIRequestBody,
        }
      : {}),
    responses,
    ...(route.security.length > 0
      ? { security: route.security.map((name) => ({ [name]: [] as string[] })) }
      : {}),
  }

  return operation
}

/**
 * Builds an OpenAPI 3.1.0 document. Pure and deterministic: the same input always
 * produces the same output, in declaration order. Documentation keys are only
 * used as `operationId`, never as path keys.
 */
export function generateDocument(input: GeneratorInput): OpenAPIDocument {
  const paths: Record<string, OpenAPIPathItem> = {}

  for (const route of input.routes) {
    const item: OpenAPIPathItem = paths[route.path] ?? {}
    const key = methodKey(route.method)

    if (item[key] !== undefined) {
      throw new Error(
        `[RiserBob OpenAPI] Refusing to overwrite ${route.method} ${route.path} (documentation key "${route.key}")`,
      )
    }

    item[key] = buildOperation(route)
    paths[route.path] = item
  }

  const document: OpenAPIDocument = {
    openapi: '3.1.0',
    info: structuredClone(input.info),
    paths,
  }
  if (input.servers.length > 0) document.servers = structuredClone([...input.servers])
  if (Object.keys(input.securitySchemes).length > 0) {
    document.components = { securitySchemes: structuredClone({ ...input.securitySchemes }) }
  }

  return document
}
