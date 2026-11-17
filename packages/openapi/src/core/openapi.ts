import type { OpenAPIDocument } from '../types/openapi.types.js'
import type { OpenAPIOptions } from '../types/route.types.js'
import type { ResolvedOptions } from '../types/internal.types.js'
import { createDocsRoutes } from '../ui/swagger-ui.js'
import { assetBase } from '../ui/swagger-ui.js'
import { findDocsConflicts, validateRegisteredRoutes } from '../validation/route-validator.js'
import { OpenAPIValidationError, type ValidationIssue } from '../validation/validation-error.js'
import { generateDocument } from './generator.js'
import { resolveOptions } from './resolve-options.js'
import type { RiserBob } from 'riser-bob'

/** The part of a RiserBob application this library needs. */
export type RiserBobApplication = Pick<RiserBob, 'spongGet' | 'spongRoutes'>

const MINIMUM_VERSION = '1.3.0'

function assertApplication(app: unknown): asserts app is RiserBobApplication {
  const candidate = app as Partial<Record<keyof RiserBobApplication, unknown>> | null | undefined

  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    typeof candidate.spongGet !== 'function'
  ) {
    throw new OpenAPIValidationError(
      [],
      '[RiserBob OpenAPI] setup() expects a RiserBob application instance.',
    )
  }

  if (typeof candidate.spongRoutes !== 'function') {
    throw new OpenAPIValidationError(
      [],
      `[RiserBob OpenAPI] Incompatible RiserBob version: the application has no spongRoutes() route introspection API. @riser-bob/openapi requires riser-bob >= ${MINIMUM_VERSION} (and < 2.0.0).`,
    )
  }
}

/**
 * OpenAPI 3.1 documentation for a RiserBob application.
 *
 * ```ts
 * const openapi = new OpenAPI({ info, routes: { getUsers: { ... } } })
 * openapi.setup(app) // after every route has been registered
 * ```
 */
export class OpenAPI {
  readonly #options: ResolvedOptions
  #app: RiserBobApplication | undefined
  #document: OpenAPIDocument | undefined

  /**
   * Validates the configuration (including every schema) and throws one
   * `OpenAPIValidationError` listing all problems.
   */
  constructor(options: OpenAPIOptions) {
    this.#options = resolveOptions(options)
  }

  /**
   * Builds the document for the routes currently registered in `app`, after strict validation.
   * Pure: it registers nothing and can be called at any time. Documented routes with
   * `isRequired: false` that are not registered are left out.
   */
  generate(app: RiserBobApplication): OpenAPIDocument {
    assertApplication(app)
    return this.#build(app)
  }

  /**
   * Validates, generates the document once and registers the documentation routes
   * (`GET <json>`, `GET <docs>` and its assets) in `app`.
   *
   * - Call it AFTER registering every application route: validation and the
   *   document reflect the routes registered at that moment.
   * - Middlewares added with `spongUse` before this call also protect the
   *   documentation; `options.middlewares` applies to it only.
   * - Calling it again with the same application is a no-op; with another
   *   application it throws (one `OpenAPI` instance serves one application).
   */
  setup(app: RiserBobApplication): void {
    assertApplication(app)

    if (this.#app !== undefined) {
      if (this.#app === app) return
      throw new OpenAPIValidationError(
        [],
        '[RiserBob OpenAPI] This OpenAPI instance is already set up with another application. Create a new OpenAPI instance per application.',
      )
    }

    const { docsPath, jsonPath, middlewares, swaggerUI } = this.#options
    const document = this.#build(app)
    const json = JSON.stringify(document)

    const routes = createDocsRoutes({ docsPath, jsonPath, json, ui: swaggerUI })
    for (const route of routes) {
      app.spongGet(route.path, route.handler, ...middlewares)
    }

    this.#document = document
    this.#app = app
  }

  /** A copy of the generated document. Only available after `setup()`. */
  getDocument(): OpenAPIDocument {
    if (this.#document === undefined) {
      throw new Error('[RiserBob OpenAPI] getDocument() is only available after setup(app).')
    }
    return structuredClone(this.#document)
  }

  #build(app: RiserBobApplication): OpenAPIDocument {
    const registered = app.spongRoutes()
    const { docsPath, jsonPath } = this.#options

    const issues: ValidationIssue[] = []
    const { issues: missing, active } = validateRegisteredRoutes(this.#options.routes, registered)
    issues.push(...missing)

    const endpoints = [
      ...(jsonPath === undefined ? [] : [{ target: 'json', path: jsonPath }]),
      ...(docsPath === undefined
        ? []
        : [
            { target: 'docs', path: docsPath },
            { target: 'docs assets', path: `${assetBase(docsPath)}/init.js` },
          ]),
    ]
    issues.push(...findDocsConflicts(endpoints, registered))

    if (issues.length > 0) throw new OpenAPIValidationError(issues)

    return generateDocument({
      info: this.#options.info,
      servers: this.#options.servers,
      securitySchemes: this.#options.securitySchemes,
      routes: active,
    })
  }
}
