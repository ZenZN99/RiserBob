import type { RegisteredRoute } from 'riser-bob'
import type { ResolvedRoute } from '../types/internal.types.js'
import { parsePath, parseRegisteredPath, routeMatchesStaticPath } from '../utils/path.js'
import type { ValidationIssue } from './validation-error.js'

export interface RouteValidationResult {
  /** Missing *required* routes (errors). */
  readonly issues: readonly ValidationIssue[]
  /** Documented routes that really exist in RiserBob, in declaration order. */
  readonly active: readonly ResolvedRoute[]
}

function rawPath(route: RegisteredRoute): string {
  return route.path
}

/**
 * Strict validation: every documented route must match a registered RiserBob
 * route on method AND path (parameter names included).
 *
 * - present                      → documented
 * - missing + isRequired (default) → error (all errors are collected)
 * - missing + isRequired: false    → left out of the document, no error
 */
export function validateRegisteredRoutes(
  routes: readonly ResolvedRoute[],
  registered: readonly RegisteredRoute[],
): RouteValidationResult {
  const exact = new Set<string>()
  const byShape = new Map<string, RegisteredRoute[]>()
  const byCanonical = new Map<string, RegisteredRoute[]>()

  for (const route of registered) {
    const parsed = parseRegisteredPath(route.path)
    exact.add(`${route.method} ${parsed.canonical}`)
    byShape.set(parsed.shape, [...(byShape.get(parsed.shape) ?? []), route])
    byCanonical.set(parsed.canonical, [...(byCanonical.get(parsed.canonical) ?? []), route])
  }

  const issues: ValidationIssue[] = []
  const active: ResolvedRoute[] = []

  for (const route of routes) {
    if (exact.has(`${route.method} ${route.path}`)) {
      active.push(route)
      continue
    }
    if (!route.isRequired) continue

    const hints: string[] = []
    const sameShape = byShape.get(route.shape) ?? []
    const sameName = sameShape.filter((r) => r.method === route.method)
    if (sameName.length > 0) {
      hints.push(
        `parameter names must match exactly; RiserBob registered ${sameName
          .map((r) => `${r.method} ${rawPath(r)}`)
          .join(', ')}`,
      )
    }
    const otherMethods = sameShape.filter((r) => r.method !== route.method)
    if (otherMethods.length > 0 && sameName.length === 0) {
      hints.push(
        `this path is registered with: ${[...new Set(otherMethods.map((r) => r.method))].join(', ')}`,
      )
    }

    issues.push({
      kind: 'missing-route',
      key: route.key,
      method: route.method,
      path: route.path,
      hints,
    })
  }

  return { issues, active }
}

export interface DocsEndpoint {
  readonly target: string
  readonly path: string
}

/**
 * A documentation path must not collide with the application's own routes:
 * RiserBob gives static routes priority, so a documentation route would silently
 * take over the path of a registered GET route (including dynamic ones like `/:slug`).
 */
export function findDocsConflicts(
  endpoints: readonly DocsEndpoint[],
  registered: readonly RegisteredRoute[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const getRoutes = registered.filter((route) => route.method === 'GET')

  for (const endpoint of endpoints) {
    const parsed = parsePath(endpoint.path)
    if (!parsed.ok) continue

    for (const route of getRoutes) {
      if (routeMatchesStaticPath(parseRegisteredPath(route.path), parsed.path)) {
        issues.push({
          kind: 'docs-conflict',
          target: endpoint.target,
          path: endpoint.path,
          message: `collides with the registered route GET ${route.path}; choose another "docs"/"json" path`,
        })
        break
      }
    }
  }

  return issues
}
