export type PathSegment =
  | { readonly kind: 'static'; readonly value: string }
  | { readonly kind: 'param'; readonly name: string }

export interface ParsedPath {
  /** OpenAPI style, normalized: `/users/{id}`. */
  readonly canonical: string
  /** Same shape with parameter names erased: `/users/{}`. */
  readonly shape: string
  readonly params: readonly string[]
  readonly segments: readonly PathSegment[]
}

export type PathParseResult =
  | { readonly ok: true; readonly path: ParsedPath }
  | { readonly ok: false; readonly reason: string }

const STATIC_SEGMENT = /^[A-Za-z0-9._~%@!$&'()*+,;=-]+$/
const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

function build(segments: PathSegment[]): ParsedPath {
  const canonical =
    '/' + segments.map((s) => (s.kind === 'param' ? `{${s.name}}` : s.value)).join('/')
  const shape = '/' + segments.map((s) => (s.kind === 'param' ? '{}' : s.value)).join('/')
  const params = segments.flatMap((s) => (s.kind === 'param' ? [s.name] : []))
  return { canonical, shape, params, segments }
}

function isUnsafeDecoded(segment: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return true
  }
  return decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')
}

/**
 * Parses a path written by a developer: RiserBob style (`:id`) or OpenAPI style (`{id}`).
 * Empty segments are dropped, exactly like RiserBob's router does, so
 * `/users/` and `/users` are the same path.
 */
export function parsePath(path: unknown): PathParseResult {
  if (typeof path !== 'string' || path === '') {
    return { ok: false, reason: 'path must be a non-empty string' }
  }
  if (!path.startsWith('/')) {
    return { ok: false, reason: 'path must start with "/"' }
  }
  if (/[?#\s\\]/.test(path) || /[\u0000-\u001f\u007f]/.test(path)) {
    return { ok: false, reason: 'path must not contain "?", "#", "\\", whitespace or control characters' }
  }

  const segments: PathSegment[] = []
  const seen = new Set<string>()

  for (const raw of path.split('/')) {
    if (raw === '') continue

    if (raw === '.' || raw === '..' || isUnsafeDecoded(raw)) {
      return { ok: false, reason: `path segment "${raw}" is not allowed (path traversal)` }
    }

    let name: string | undefined
    if (raw.startsWith(':')) {
      name = raw.slice(1)
    } else if (raw.startsWith('{') && raw.endsWith('}')) {
      name = raw.slice(1, -1)
    }

    if (name !== undefined) {
      if (!PARAM_NAME.test(name)) {
        return {
          ok: false,
          reason: `invalid parameter segment "${raw}" (names must match ${PARAM_NAME.source})`,
        }
      }
      if (seen.has(name)) {
        return { ok: false, reason: `parameter "${name}" appears more than once` }
      }
      seen.add(name)
      segments.push({ kind: 'param', name })
      continue
    }

    if (!STATIC_SEGMENT.test(raw)) {
      return { ok: false, reason: `invalid path segment "${raw}"` }
    }
    segments.push({ kind: 'static', value: raw })
  }

  return { ok: true, path: build(segments) }
}

/** Parses a path as stored by RiserBob's router (already normalized, `:id` style). */
export function parseRegisteredPath(path: string): ParsedPath {
  const segments: PathSegment[] = path
    .split('/')
    .filter(Boolean)
    .map((raw): PathSegment =>
      raw.startsWith(':') ? { kind: 'param', name: raw.slice(1) } : { kind: 'static', value: raw },
    )
  return build(segments)
}

/** True when a registered (possibly dynamic) route would match the concrete path `target`. */
export function routeMatchesStaticPath(route: ParsedPath, target: ParsedPath): boolean {
  if (route.segments.length !== target.segments.length) return false

  return route.segments.every((segment, index) => {
    if (segment.kind === 'param') return true
    const other = target.segments[index]
    return other !== undefined && other.kind === 'static' && other.value === segment.value
  })
}
