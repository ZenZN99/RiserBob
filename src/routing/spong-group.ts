import { SpongMethod, type HttpMethod } from '../types/spong-method'
import type { SpongHandler } from '../types/spong-handler'
import type { SpongRequest } from '../types/spong-request'
import type { SpongMiddleware } from '../types/spong-middleware'
import { ErrorMessages } from '../errors/errors-messages'

type RouteRegistrar = (
  method: HttpMethod,
  path: string,
  handler: SpongHandler,
  ...middlewares: SpongMiddleware<SpongRequest>[]
) => void

function joinPaths(prefix: string, path: string, errorMessages: ErrorMessages): string {
  if (!prefix.startsWith('/')) {
    throw new Error(errorMessages.invalidPath(prefix))
  }

  if (!path.startsWith('/')) {
    throw new Error(errorMessages.invalidPath(path))
  }

  const base = prefix === '/' ? '' : prefix.replace(/\/+$/, '')
  const segment = path.replace(/^\/+/, '')

  return segment ? `${base}/${segment}` : base || '/'
}

export class SpongRouteGroup {
  constructor(
    private readonly registerRoute: RouteRegistrar,
    private readonly prefix: string,
    private readonly errorMessages: ErrorMessages,
    private readonly middlewares: SpongMiddleware<SpongRequest>[] = [],
  ) {
    if (!prefix.startsWith('/')) {
      throw new Error(this.errorMessages.invalidPath(prefix))
    }
  }

  private register(
    method: HttpMethod,
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    const fullPath = joinPaths(this.prefix, path, this.errorMessages)

    this.registerRoute(method, fullPath, handler, ...this.middlewares, ...middlewares)

    return this
  }

  spongGet(
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    return this.register(SpongMethod.GET, path, handler, ...middlewares)
  }

  spongPost(
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    return this.register(SpongMethod.POST, path, handler, ...middlewares)
  }

  spongPut(
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    return this.register(SpongMethod.PUT, path, handler, ...middlewares)
  }

  spongPatch(
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    return this.register(SpongMethod.PATCH, path, handler, ...middlewares)
  }

  spongDelete(
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    return this.register(SpongMethod.DELETE, path, handler, ...middlewares)
  }

  spongHead(
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    return this.register(SpongMethod.HEAD, path, handler, ...middlewares)
  }

  spongOptions(
    path: string,
    handler: SpongHandler,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    return this.register(SpongMethod.OPTIONS, path, handler, ...middlewares)
  }

  spongUse(middleware: SpongMiddleware<SpongRequest>): this {
    this.middlewares.push(middleware)
    return this
  }

  spongGroup(
    prefix: string,
    callback: (group: SpongRouteGroup) => void,
    ...middlewares: SpongMiddleware<SpongRequest>[]
  ): this {
    const fullPrefix = joinPaths(this.prefix, prefix, this.errorMessages)

    const nestedGroup = new SpongRouteGroup(this.registerRoute, fullPrefix, this.errorMessages, [
      ...this.middlewares,
      ...middlewares,
    ])

    callback(nestedGroup)

    return this
  }
}
