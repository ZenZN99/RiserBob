import type {
  OpenAPIInfo,
  OpenAPISecurityScheme,
  OpenAPIServer,
} from '../types/openapi.types.js'
import type { OpenAPIMethod } from '../types/route.types.js'
import type {
  ResolvedOptions,
  ResolvedResponse,
  ResolvedRoute,
  ResolvedSwaggerUI,
} from '../types/internal.types.js'
import type { ConvertedSchema } from '../types/schema.types.js'
import type { SpongMiddleware, SpongRequest } from 'riser-bob'
import { convertSchema, SchemaConversionError } from '../schemas/schema-converter.js'
import { OpenAPIValidationError, type ValidationIssue } from '../validation/validation-error.js'
import { hasControlCharacters, isHttpUrl, isNonEmptyString, isRecord } from '../utils/guards.js'
import { parsePath } from '../utils/path.js'

const METHODS: ReadonlySet<string> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])
const BODY_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
])
const MEDIA_TYPE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/
const ROUTE_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/
const SCHEME_NAME = /^[A-Za-z0-9._-]+$/
// RFC 9110 §9.3: these methods must not carry request bodies in OpenAPI.
const METHODS_WITHOUT_BODY: ReadonlySet<string> = new Set(['GET', 'HEAD'])
// OpenAPI 3.1: header parameters with these names are ignored by tooling.
const RESERVED_HEADERS: ReadonlySet<string> = new Set(['accept', 'content-type', 'authorization'])
const BODYLESS_STATUS = (status: number): boolean =>
  (status >= 100 && status < 200) || status === 204 || status === 304

const DEFAULT_DOCS = '/docs'
const DEFAULT_JSON = '/docs/json'

class Collector {
  readonly issues: ValidationIssue[] = []

  add(location: string, message: string): void {
    this.issues.push({ kind: 'config', location, message })
  }

  /** Rejects properties that are not part of the documented configuration shape. */
  unknownKeys(value: Record<string, unknown>, allowed: readonly string[], location: string): void {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        this.add(location, `unknown property "${key}" (allowed: ${allowed.join(', ')})`)
      }
    }
  }
}

function optionalString(
  c: Collector,
  source: Record<string, unknown>,
  key: string,
  location: string,
): string | undefined {
  const value = source[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    c.add(`${location}.${key}`, 'must be a string')
    return undefined
  }
  return value
}

function resolveInfo(c: Collector, raw: unknown): OpenAPIInfo {
  const fallback: OpenAPIInfo = { title: '', version: '' }
  if (!isRecord(raw)) {
    c.add('info', 'is required and must be an object with at least "title" and "version"')
    return fallback
  }
  c.unknownKeys(
    raw,
    ['title', 'version', 'description', 'termsOfService', 'contact', 'license'],
    'info',
  )

  const title = raw['title']
  const version = raw['version']
  if (!isNonEmptyString(title)) c.add('info.title', 'is required and must be a non-empty string')
  if (!isNonEmptyString(version)) c.add('info.version', 'is required and must be a non-empty string')

  const info: { -readonly [K in keyof OpenAPIInfo]: OpenAPIInfo[K] } = {
    title: isNonEmptyString(title) ? title : '',
    version: isNonEmptyString(version) ? version : '',
  }

  const description = optionalString(c, raw, 'description', 'info')
  if (description !== undefined) info.description = description

  const terms = optionalString(c, raw, 'termsOfService', 'info')
  if (terms !== undefined) {
    if (isHttpUrl(terms)) info.termsOfService = terms
    else c.add('info.termsOfService', 'must be an absolute http(s) URL')
  }

  const contact = raw['contact']
  if (contact !== undefined) {
    if (!isRecord(contact)) {
      c.add('info.contact', 'must be an object')
    } else {
      c.unknownKeys(contact, ['name', 'email', 'url'], 'info.contact')
      const out: { name?: string; email?: string; url?: string } = {}
      const name = optionalString(c, contact, 'name', 'info.contact')
      if (name !== undefined) out.name = name
      const email = optionalString(c, contact, 'email', 'info.contact')
      if (email !== undefined) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email
        else c.add('info.contact.email', 'must be a valid email address')
      }
      const url = optionalString(c, contact, 'url', 'info.contact')
      if (url !== undefined) {
        if (isHttpUrl(url)) out.url = url
        else c.add('info.contact.url', 'must be an absolute http(s) URL')
      }
      info.contact = out
    }
  }

  const license = raw['license']
  if (license !== undefined) {
    if (!isRecord(license)) {
      c.add('info.license', 'must be an object')
    } else {
      c.unknownKeys(license, ['name', 'url'], 'info.license')
      const name = license['name']
      if (!isNonEmptyString(name)) {
        c.add('info.license.name', 'is required and must be a non-empty string')
      } else {
        const out: { name: string; url?: string } = { name }
        const url = optionalString(c, license, 'url', 'info.license')
        if (url !== undefined) {
          if (isHttpUrl(url)) out.url = url
          else c.add('info.license.url', 'must be an absolute http(s) URL')
        }
        info.license = out
      }
    }
  }

  return info
}

function resolveServers(c: Collector, raw: unknown): OpenAPIServer[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    c.add('servers', 'must be an array')
    return []
  }
  const servers: OpenAPIServer[] = []
  ;(raw as readonly unknown[]).forEach((entry, index) => {
    const location = `servers[${index}]`
    if (!isRecord(entry)) return c.add(location, 'must be an object')
    c.unknownKeys(entry, ['url', 'description'], location)
    const url = entry['url']
    if (typeof url !== 'string' || !(isHttpUrl(url) || (url.startsWith('/') && !/[\s\\]/.test(url)))) {
      return c.add(`${location}.url`, 'must be an absolute http(s) URL or a path starting with "/"')
    }
    const description = optionalString(c, entry, 'description', location)
    servers.push(description === undefined ? { url } : { url, description })
  })
  return servers
}

function resolveSecuritySchemes(
  c: Collector,
  raw: unknown,
): Record<string, OpenAPISecurityScheme> {
  const schemes: Record<string, OpenAPISecurityScheme> = {}
  if (raw === undefined) return schemes
  if (!isRecord(raw)) {
    c.add('securitySchemes', 'must be an object')
    return schemes
  }

  for (const [name, value] of Object.entries(raw)) {
    const location = `securitySchemes.${name}`
    if (!SCHEME_NAME.test(name)) {
      c.add(location, `invalid scheme name (allowed characters: ${SCHEME_NAME.source})`)
      continue
    }
    if (!isRecord(value)) {
      c.add(location, 'must be an object')
      continue
    }

    const description = optionalString(c, value, 'description', location)
    const withDescription = <T extends object>(scheme: T): T & { description?: string } =>
      description === undefined ? scheme : { ...scheme, description }

    if (value['type'] === 'http') {
      c.unknownKeys(value, ['type', 'scheme', 'bearerFormat', 'description'], location)
      if (value['scheme'] !== 'bearer') {
        c.add(`${location}.scheme`, 'only "bearer" is supported for type "http"')
        continue
      }
      const bearerFormat = optionalString(c, value, 'bearerFormat', location)
      schemes[name] = withDescription({
        type: 'http' as const,
        scheme: 'bearer' as const,
        ...(bearerFormat === undefined ? {} : { bearerFormat }),
      })
    } else if (value['type'] === 'apiKey') {
      c.unknownKeys(value, ['type', 'in', 'name', 'description'], location)
      const where = value['in']
      const keyName = value['name']
      if (where !== 'header' && where !== 'query' && where !== 'cookie') {
        c.add(`${location}.in`, 'must be "header", "query" or "cookie"')
        continue
      }
      if (!isNonEmptyString(keyName) || /[\s]/.test(keyName)) {
        c.add(`${location}.name`, 'is required and must be a non-empty string without whitespace')
        continue
      }
      schemes[name] = withDescription({ type: 'apiKey' as const, in: where, name: keyName })
    } else {
      c.add(`${location}.type`, 'must be "http" (bearer) or "apiKey"')
    }
  }
  return schemes
}

function resolveEndpointPath(
  c: Collector,
  raw: unknown,
  location: string,
): string | undefined | false {
  if (raw === undefined) return undefined
  if (raw === false) return false
  const parsed = parsePath(raw)
  if (!parsed.ok) {
    c.add(location, parsed.reason)
    return undefined
  }
  if (parsed.path.params.length > 0) {
    c.add(location, 'documentation paths cannot contain parameters')
    return undefined
  }
  return parsed.path.canonical
}

function resolveSwaggerUI(c: Collector, raw: unknown, title: string): ResolvedSwaggerUI {
  const ui: { title: string; persistAuthorization: boolean; docExpansion: 'list' | 'full' | 'none' } =
    { title, persistAuthorization: false, docExpansion: 'list' }
  if (raw === undefined) return ui
  if (!isRecord(raw)) {
    c.add('swaggerUI', 'must be an object')
    return ui
  }
  c.unknownKeys(raw, ['title', 'persistAuthorization', 'docExpansion'], 'swaggerUI')

  const uiTitle = raw['title']
  if (uiTitle !== undefined) {
    if (isNonEmptyString(uiTitle) && !hasControlCharacters(uiTitle)) ui.title = uiTitle
    else c.add('swaggerUI.title', 'must be a non-empty single-line string')
  }
  const persist = raw['persistAuthorization']
  if (persist !== undefined) {
    if (typeof persist === 'boolean') ui.persistAuthorization = persist
    else c.add('swaggerUI.persistAuthorization', 'must be a boolean')
  }
  const expansion = raw['docExpansion']
  if (expansion !== undefined) {
    if (expansion === 'list' || expansion === 'full' || expansion === 'none') {
      ui.docExpansion = expansion
    } else {
      c.add('swaggerUI.docExpansion', 'must be "list", "full" or "none"')
    }
  }
  return ui
}

function convert(c: Collector, raw: unknown, location: string): ConvertedSchema | undefined {
  try {
    return convertSchema(raw)
  } catch (error) {
    if (error instanceof SchemaConversionError) {
      for (const problem of error.problems) c.add(location, problem)
      return undefined
    }
    throw error
  }
}

function resolveRoute(
  c: Collector,
  key: string,
  raw: unknown,
  securityNames: ReadonlySet<string>,
): ResolvedRoute | undefined {
  const base = `routes.${key}`
  if (!ROUTE_KEY.test(key)) {
    c.add(base, `invalid documentation key (allowed characters: ${ROUTE_KEY.source})`)
    return undefined
  }
  if (!isRecord(raw)) {
    c.add(base, 'must be an object')
    return undefined
  }
  const before = c.issues.length

  c.unknownKeys(
    raw,
    [
      'method',
      'path',
      'summary',
      'description',
      'tags',
      'isRequired',
      'deprecated',
      'request',
      'response',
      'security',
    ],
    base,
  )

  // method
  const rawMethod = raw['method']
  let method: OpenAPIMethod | undefined
  if (typeof rawMethod !== 'string' || !METHODS.has(rawMethod)) {
    c.add(
      `${base}.method`,
      rawMethod === 'OPTIONS'
        ? 'OPTIONS cannot be documented: RiserBob answers every OPTIONS request (CORS preflight) before routing'
        : `must be one of ${[...METHODS].join(', ')}`,
    )
  } else {
    method = rawMethod as OpenAPIMethod
  }

  // path
  const parsedPath = parsePath(raw['path'])
  if (!parsedPath.ok) c.add(`${base}.path`, parsedPath.reason)

  // text
  const summary = optionalString(c, raw, 'summary', base)
  const description = optionalString(c, raw, 'description', base)
  if (summary !== undefined && hasControlCharacters(summary)) {
    c.add(`${base}.summary`, 'must be a single-line string')
  }

  // tags
  let tags: string[] | undefined
  if (raw['tags'] !== undefined) {
    const rawTags = raw['tags']
    if (!Array.isArray(rawTags) || !(rawTags as readonly unknown[]).every(isNonEmptyString)) {
      c.add(`${base}.tags`, 'must be an array of non-empty strings')
    } else {
      tags = [...new Set(rawTags as readonly string[])]
    }
  }

  // flags
  const isRequired = raw['isRequired']
  if (isRequired !== undefined && typeof isRequired !== 'boolean') {
    c.add(`${base}.isRequired`, 'must be a boolean')
  }
  const deprecated = raw['deprecated']
  if (deprecated !== undefined && typeof deprecated !== 'boolean') {
    c.add(`${base}.deprecated`, 'must be a boolean')
  }

  // security
  let security: string[] = []
  if (raw['security'] !== undefined) {
    const rawSecurity = raw['security']
    if (!Array.isArray(rawSecurity) || !(rawSecurity as readonly unknown[]).every(isNonEmptyString)) {
      c.add(`${base}.security`, 'must be an array of security scheme names')
    } else {
      security = [...new Set(rawSecurity as readonly string[])]
      for (const name of security) {
        if (!securityNames.has(name)) {
          c.add(`${base}.security`, `unknown security scheme "${name}" (declare it in securitySchemes)`)
        }
      }
    }
  }

  // request
  let body: ResolvedRoute['body']
  let query: ConvertedSchema | undefined
  let params: ConvertedSchema | undefined
  let headers: ConvertedSchema | undefined
  const pathParamNames = parsedPath.ok ? parsedPath.path.params : []

  const request = raw['request']
  if (request !== undefined) {
    const rl = `${base}.request`
    if (!isRecord(request)) {
      c.add(rl, 'must be an object')
    } else {
      c.unknownKeys(request, ['body', 'contentType', 'query', 'params', 'headers'], rl)

      const contentType = request['contentType']
      if (contentType !== undefined && (typeof contentType !== 'string' || !BODY_CONTENT_TYPES.has(contentType))) {
        c.add(`${rl}.contentType`, `must be one of ${[...BODY_CONTENT_TYPES].join(', ')}`)
      }

      if (request['body'] !== undefined) {
        if (method !== undefined && METHODS_WITHOUT_BODY.has(method)) {
          c.add(`${rl}.body`, `${method} requests must not have a request body`)
        } else {
          const schema = convert(c, request['body'], `${rl}.body`)
          if (schema) {
            body = {
              schema,
              contentType: typeof contentType === 'string' ? contentType : 'application/json',
            }
          }
        }
      } else if (contentType !== undefined) {
        c.add(`${rl}.contentType`, 'is only valid together with "body"')
      }

      if (request['query'] !== undefined) query = convert(c, request['query'], `${rl}.query`)
      if (request['headers'] !== undefined) {
        headers = convert(c, request['headers'], `${rl}.headers`)
        for (const field of headers?.fields ?? []) {
          if (RESERVED_HEADERS.has(field.name.toLowerCase())) {
            c.add(
              `${rl}.headers`,
              `header "${field.name}" is reserved by OpenAPI; document it with "security" or "body.contentType" instead`,
            )
          }
        }
      }
      if (request['params'] !== undefined) {
        params = convert(c, request['params'], `${rl}.params`)
        for (const field of params?.fields ?? []) {
          if (!pathParamNames.includes(field.name)) {
            c.add(
              `${rl}.params`,
              `field "${field.name}" is not a parameter of path "${typeof raw['path'] === 'string' ? raw['path'] : ''}"`,
            )
          } else if (Array.isArray(field.schema.type)) {
            c.add(`${rl}.params`, `path parameter "${field.name}" cannot be nullable`)
          }
        }
      }
    }
  }

  // responses
  const responses: ResolvedResponse[] = []
  const rawResponses = raw['response']
  if (!isRecord(rawResponses)) {
    c.add(`${base}.response`, 'is required and must be an object keyed by HTTP status code')
  } else {
    const entries = Object.entries(rawResponses)
    if (entries.length === 0) c.add(`${base}.response`, 'must document at least one status code')

    for (const [statusKey, value] of entries) {
      const rl = `${base}.response.${statusKey}`
      const status = Number(statusKey)
      if (!/^[1-5]\d\d$/.test(statusKey) || !Number.isInteger(status)) {
        c.add(rl, 'invalid HTTP status code (expected an integer between 100 and 599)')
        continue
      }
      if (!isRecord(value)) {
        c.add(rl, 'must be an object')
        continue
      }
      c.unknownKeys(value, ['description', 'schema', 'contentType'], rl)

      const responseDescription = value['description']
      if (!isNonEmptyString(responseDescription)) {
        c.add(`${rl}.description`, 'is required and must be a non-empty string')
        continue
      }

      const rawContentType = value['contentType']
      if (rawContentType !== undefined && (typeof rawContentType !== 'string' || !MEDIA_TYPE.test(rawContentType))) {
        c.add(`${rl}.contentType`, 'must be a valid lowercase media type (e.g. "application/json")')
        continue
      }

      let schema: ConvertedSchema | undefined
      if (value['schema'] !== undefined) {
        if (BODYLESS_STATUS(status)) {
          c.add(`${rl}.schema`, `status ${status} cannot have a response body`)
        } else {
          schema = convert(c, value['schema'], `${rl}.schema`)
        }
      } else if (rawContentType !== undefined) {
        c.add(`${rl}.contentType`, 'is only valid together with "schema"')
      }

      responses.push({
        status,
        description: responseDescription,
        ...(schema ? { schema } : {}),
        contentType: typeof rawContentType === 'string' ? rawContentType : 'application/json',
      })
    }
  }

  if (c.issues.length > before || method === undefined || !parsedPath.ok) return undefined

  return {
    key,
    method,
    path: parsedPath.path.canonical,
    shape: parsedPath.path.shape,
    pathParams: parsedPath.path.params,
    ...(summary === undefined ? {} : { summary }),
    ...(description === undefined ? {} : { description }),
    ...(tags === undefined ? {} : { tags }),
    deprecated: deprecated === true,
    isRequired: isRequired !== false,
    security,
    ...(body ? { body } : {}),
    ...(query ? { query } : {}),
    ...(params ? { params } : {}),
    ...(headers ? { headers } : {}),
    responses: responses.sort((a, b) => a.status - b.status),
  }
}

const TOP_LEVEL_KEYS = [
  'info',
  'docs',
  'json',
  'routes',
  'servers',
  'securitySchemes',
  'middlewares',
  'swaggerUI',
] as const

/**
 * Validates and normalizes the developer-provided configuration.
 * Everything is copied, so later mutations of the original object cannot affect the library.
 * All problems found are reported together in one `OpenAPIValidationError`.
 */
export function resolveOptions(options: unknown): ResolvedOptions {
  const c = new Collector()

  if (!isRecord(options)) {
    throw new OpenAPIValidationError([
      { kind: 'config', location: 'options', message: 'must be an object' },
    ])
  }
  c.unknownKeys(options, TOP_LEVEL_KEYS, 'options')

  const info = resolveInfo(c, options['info'])
  const servers = resolveServers(c, options['servers'])
  const securitySchemes = resolveSecuritySchemes(c, options['securitySchemes'])

  // documentation endpoints
  const docs = resolveEndpointPath(c, options['docs'], 'docs')
  const json = resolveEndpointPath(c, options['json'], 'json')
  const docsPath = docs === undefined ? DEFAULT_DOCS : docs === false ? undefined : docs
  const jsonPath = json === undefined ? DEFAULT_JSON : json === false ? undefined : json
  if (docsPath !== undefined && jsonPath === undefined) {
    c.add('json', 'cannot be disabled while Swagger UI ("docs") is enabled: the UI reads the JSON endpoint')
  }
  if (docsPath !== undefined && docsPath === jsonPath) {
    c.add('json', '"docs" and "json" must use different paths')
  }

  // middlewares
  const rawMiddlewares = options['middlewares']
  let middlewares: SpongMiddleware<SpongRequest>[] = []
  if (rawMiddlewares !== undefined) {
    if (!Array.isArray(rawMiddlewares) || !(rawMiddlewares as readonly unknown[]).every((m) => typeof m === 'function')) {
      c.add('middlewares', 'must be an array of RiserBob middleware functions')
    } else {
      middlewares = [...(rawMiddlewares as SpongMiddleware<SpongRequest>[])]
    }
  }

  const swaggerUI = resolveSwaggerUI(c, options['swaggerUI'], info.title || 'API Documentation')

  // routes
  const routes: ResolvedRoute[] = []
  const rawRoutes = options['routes']
  if (!isRecord(rawRoutes)) {
    c.add('routes', 'is required and must be an object (use {} for no routes)')
  } else {
    const securityNames = new Set(Object.keys(securitySchemes))
    for (const [key, value] of Object.entries(rawRoutes)) {
      const route = resolveRoute(c, key, value, securityNames)
      if (route) routes.push(route)
    }

    // Two documented routes must never describe the same operation.
    const seen = new Map<string, ResolvedRoute>()
    for (const route of routes) {
      const identity = `${route.method} ${route.shape}`
      const previous = seen.get(identity)
      if (previous) {
        c.add(
          `routes.${route.key}`,
          `conflicts with routes.${previous.key}: both document ${route.method} ${route.path} (${previous.path})`,
        )
      } else {
        seen.set(identity, route)
      }
    }
  }

  if (c.issues.length > 0) throw new OpenAPIValidationError(c.issues)

  return {
    info,
    servers,
    securitySchemes,
    docsPath,
    jsonPath,
    middlewares,
    swaggerUI,
    routes,
  }
}
