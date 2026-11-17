import type { ErrorMessages } from '../errors/errors-messages'
import type { RegisteredRoute } from '../types/registered-route'
import type { SpongHandler } from '../types/spong-handler'
import { SpongMethod, type HttpMethod } from '../types/spong-method'

interface DynamicRoute {
  path: string
  handler: SpongHandler
  parts: string[]
}

export class Router {
  private routes = new Map<string, SpongHandler>()

  private staticRoutes = new Map<string, SpongHandler>()

  private dynamicRoutes = new Map<string, DynamicRoute[]>()

  constructor(private readonly errorMessages: ErrorMessages) {}

  private normalizePath(path: string): string {
    const parts = path.split('/').filter(Boolean)
    return '/' + parts.join('/')
  }

  register(method: HttpMethod, path: string, handler: SpongHandler): this {
    const normalizedPath = this.normalizePath(path)
    const key = `${method} ${normalizedPath}`

    if (this.routes.has(key)) {
      throw new Error(this.errorMessages.duplicateRoute(key))
    }

    this.routes.set(key, handler)

    if (!path.includes(':')) {
      this.staticRoutes.set(key, handler)
      return this
    }

    let routes = this.dynamicRoutes.get(method)

    if (!routes) {
      routes = []
      this.dynamicRoutes.set(method, routes)
    }

    routes.push({
      path: normalizedPath,
      handler,
      parts: normalizedPath.split('/').filter(Boolean),
    })

    routes.sort((a, b) => this.compareRoutes(a.path, b.path))

    return this
  }

  private matchPath(
    routeParts: string[],
    requestParts: string[],
  ): Record<string, string> | undefined {
    if (routeParts.length !== requestParts.length) {
      return undefined
    }

    let params: Record<string, string> | undefined

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]
      const requestPart = requestParts[i]

      if (!routePart || !requestPart) {
        return undefined
      }

      if (routePart.startsWith(':')) {
        const paramName = routePart.slice(1)

        if (!paramName) {
          return undefined
        }

        let decoded: string

        try {
          decoded = decodeURIComponent(requestPart)
        } catch {
          return undefined
        }

        if (!params) params = {}

        params[paramName] = decoded
      } else if (routePart !== requestPart) {
        return undefined
      }
    }

    return params ?? {}
  }

  private compareRoutes(aPath: string, bPath: string): number {
    const a = aPath.split('/').filter(Boolean)
    const b = bPath.split('/').filter(Boolean)

    const length = Math.min(a.length, b.length)

    for (let i = 0; i < length; i++) {
      const aDynamic = a[i]!.startsWith(':')
      const bDynamic = b[i]!.startsWith(':')

      if (aDynamic !== bDynamic) {
        return Number(aDynamic) - Number(bDynamic)
      }
    }

    return b.length - a.length
  }

  list(): readonly RegisteredRoute[] {
    return Object.freeze(
      Array.from(this.routes.keys(), (key) => {
        const separator = key.indexOf(' ')

        return Object.freeze({
          method: key.slice(0, separator) as HttpMethod,
          path: key.slice(separator + 1),
        })
      }),
    )
  }

  match(
    method: string,
    path: string,
  ):
    | {
        handler: SpongHandler
        params: Record<string, string>
      }
    | undefined {
    const staticHandler =
      this.staticRoutes.get(`${method} ${path}`) ??
      this.staticRoutes.get(`${method} ${this.normalizePath(path)}`)

    if (staticHandler) {
      return {
        handler: staticHandler,
        params: {},
      }
    }

    const routes = this.dynamicRoutes.get(method)

    if (!routes || routes.length === 0) {
      return undefined
    }

    const requestParts = path.split('/').filter(Boolean)

    for (const route of routes) {
      const params = this.matchPath(route.parts, requestParts)

      if (params !== undefined) {
        return {
          handler: route.handler,
          params,
        }
      }
    }

    return undefined
  }

  allowedMethods(path: string): HttpMethod[] {
    const methods: HttpMethod[] = [
      SpongMethod.GET,
      SpongMethod.HEAD,
      SpongMethod.POST,
      SpongMethod.PUT,
      SpongMethod.PATCH,
      SpongMethod.DELETE,
      SpongMethod.OPTIONS,
    ]

    const normalizedPath = this.normalizePath(path)

    return methods.filter((method) => this.routes.has(`${method} ${normalizedPath}`))
  }
}
