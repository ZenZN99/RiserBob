import { describe, expect, test } from 'bun:test'
import { ErrorMessages } from '../../../src/errors/errors-messages'
import type { SpongRequest } from '../../../src/types/spong-request'
import type { SpongHandler } from '../../../src/types/spong-handler'
import type { SpongMiddleware } from '../../../src/types/spong-middleware'
import { SpongMethod } from '../../../src/types/spong-method'
import type { HttpMethod } from '../../../dist/types/spong-method'
import { SpongRouteGroup } from '../../../src/routing/spong-group'

describe('SpongRouteGroup', () => {
  const errorMessages = new ErrorMessages(false)

  const createHandler = (): SpongHandler => (() => new Response()) as unknown as SpongHandler

  const createMiddleware = (): SpongMiddleware<SpongRequest> =>
    (() => undefined) as unknown as SpongMiddleware<SpongRequest>

  function createGroup(prefix = '/api') {
    const calls: {
      method: HttpMethod
      path: string
      handler: SpongHandler
      middlewares: SpongMiddleware<SpongRequest>[]
    }[] = []

    const registerRoute = (
      method: HttpMethod,
      path: string,
      handler: SpongHandler,
      ...middlewares: SpongMiddleware<SpongRequest>[]
    ): void => {
      calls.push({ method, path, handler, middlewares })
    }

    const group = new SpongRouteGroup(registerRoute, prefix, errorMessages)

    return { group, calls }
  }

  test('should register GET routes with the group prefix', () => {
    const { group, calls } = createGroup()
    const handler = createHandler()

    group.spongGet('/users', handler)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe(SpongMethod.GET)
    expect(calls[0]!.path).toBe('/api/users')
    expect(calls[0]!.handler).toBe(handler)
  })

  test('should register all supported HTTP methods', () => {
    const { group, calls } = createGroup()
    const handler = createHandler()

    group.spongGet('/get', handler)
    group.spongPost('/post', handler)
    group.spongPut('/put', handler)
    group.spongPatch('/patch', handler)
    group.spongDelete('/delete', handler)
    group.spongHead('/head', handler)
    group.spongOptions('/options', handler)

    expect(calls).toHaveLength(7)

    expect(calls.map((call) => call.method)).toEqual([
      SpongMethod.GET,
      SpongMethod.POST,
      SpongMethod.PUT,
      SpongMethod.PATCH,
      SpongMethod.DELETE,
      SpongMethod.HEAD,
      SpongMethod.OPTIONS,
    ])
  })

  test('should handle root paths without trailing slashes', () => {
    const { group, calls } = createGroup('/api/users')

    group.spongGet('/', createHandler())

    expect(calls[0]!.path).toBe('/api/users')
  })

  test('should support group middleware through spongUse', () => {
    const { group, calls } = createGroup()
    const middleware = createMiddleware()
    const handler = createHandler()

    group.spongUse(middleware)
    group.spongGet('/users', handler)

    expect(calls[0]!.middlewares).toEqual([middleware])
  })

  test('should apply route-specific middleware after group middleware', () => {
    const { group, calls } = createGroup()
    const groupMiddleware = createMiddleware()
    const routeMiddleware = createMiddleware()

    group.spongUse(groupMiddleware)
    group.spongGet('/users', createHandler(), routeMiddleware)

    expect(calls[0]!.middlewares).toEqual([groupMiddleware, routeMiddleware])
  })

  test('should not apply middleware to routes registered before spongUse', () => {
    const { group, calls } = createGroup()
    const middleware = createMiddleware()

    group.spongGet('/public', createHandler())
    group.spongUse(middleware)
    group.spongGet('/protected', createHandler())

    expect(calls[0]!.middlewares).toEqual([])
    expect(calls[1]!.middlewares).toEqual([middleware])
  })

  test('should support nested groups and inherit prefixes', () => {
    const { group, calls } = createGroup()

    group.spongGroup('/users', (users) => {
      users.spongGet('/', createHandler())
      users.spongGet('/:id', createHandler())

      users.spongGroup('/posts', (posts) => {
        posts.spongGet('/', createHandler())
        posts.spongPost('/', createHandler())
      })
    })

    expect(calls.map((call) => call.path)).toEqual([
      '/api/users',
      '/api/users/:id',
      '/api/users/posts',
      '/api/users/posts',
    ])
  })

  test('should inherit parent and child middlewares in nested groups', () => {
    const { group, calls } = createGroup()

    const parentMiddleware = createMiddleware()
    const childMiddleware = createMiddleware()
    const routeMiddleware = createMiddleware()

    group.spongUse(parentMiddleware)

    group.spongGroup('/users', (users) => {
      users.spongUse(childMiddleware)

      users.spongGet('/', createHandler(), routeMiddleware)
    })

    expect(calls[0]!.middlewares).toEqual([parentMiddleware, childMiddleware, routeMiddleware])
  })

  test('should inherit middleware through multiple nested levels', () => {
    const { group, calls } = createGroup()

    const parentMiddleware = createMiddleware()
    const childMiddleware = createMiddleware()
    const nestedMiddleware = createMiddleware()

    group.spongUse(parentMiddleware)

    group.spongGroup('/users', (users) => {
      users.spongUse(childMiddleware)

      users.spongGroup('/admin', (admin) => {
        admin.spongUse(nestedMiddleware)
        admin.spongGet('/dashboard', createHandler())
      })
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]!.path).toBe('/api/users/admin/dashboard')

    expect(calls[0]!.middlewares).toEqual([parentMiddleware, childMiddleware, nestedMiddleware])
  })

  test('should apply middleware passed directly to spongGroup', () => {
    const { group, calls } = createGroup()

    const groupMiddleware = createMiddleware()
    const routeMiddleware = createMiddleware()

    group.spongGroup(
      '/admin',
      (admin) => {
        admin.spongGet('/dashboard', createHandler(), routeMiddleware)
      },
      groupMiddleware,
    )

    expect(calls[0]!.path).toBe('/api/admin/dashboard')
    expect(calls[0]!.middlewares).toEqual([groupMiddleware, routeMiddleware])
  })

  test('should preserve parent middleware when creating nested groups', () => {
    const { group, calls } = createGroup()

    const parentMiddleware = createMiddleware()
    const childMiddleware = createMiddleware()

    group.spongUse(parentMiddleware)

    group.spongGroup(
      '/users',
      (users) => {
        users.spongGet('/', createHandler())
      },
      childMiddleware,
    )

    expect(calls[0]!.middlewares).toEqual([parentMiddleware, childMiddleware])
  })

  test('should return the same group instance for method chaining', () => {
    const { group } = createGroup()

    expect(group.spongGet('/', createHandler())).toBe(group)
    expect(group.spongPost('/', createHandler())).toBe(group)
    expect(group.spongUse(createMiddleware())).toBe(group)
    expect(group.spongGroup('/users', () => {})).toBe(group)
  })

  test('should reject invalid group prefixes', () => {
    expect(() => createGroup('api')).toThrow()
  })

  test('should reject invalid route paths', () => {
    const { group } = createGroup()

    expect(() => {
      group.spongGet('users', createHandler())
    }).toThrow()
  })

  test('should reject invalid nested group prefixes', () => {
    const { group } = createGroup()

    expect(() => {
      group.spongGroup('users', () => {})
    }).toThrow()
  })
})
