import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { SpongHandler } from 'riser-bob'
import type { ResolvedSwaggerUI } from '../types/internal.types.js'

/** The only files ever served from `swagger-ui-dist` (a fixed whitelist: no path is taken from the request). */
const ASSETS = [
  { file: 'swagger-ui.css', type: 'text/css; charset=utf-8' },
  { file: 'swagger-ui-bundle.js', type: 'text/javascript; charset=utf-8' },
] as const

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
} as const

// Everything is served by the application itself: no external CDN, no inline scripts.
// Swagger UI needs inline styles; `connect-src 'self'` allows "Try it out" against this origin only.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

export interface DocsRoute {
  readonly path: string
  readonly handler: SpongHandler
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function locateSwaggerUiDirectory(): string {
  const require = createRequire(import.meta.url)
  try {
    const directory = dirname(require.resolve('swagger-ui-dist/package.json'))
    for (const asset of ASSETS) {
      if (!existsSync(join(directory, asset.file))) {
        throw new Error(`missing file ${asset.file}`)
      }
    }
    return directory
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `[RiserBob OpenAPI] Swagger UI assets are unavailable (${reason}). Reinstall "@riser-bob/openapi" so that its "swagger-ui-dist" dependency is present, or disable the UI with docs: false.`,
    )
  }
}

export function assetBase(docsPath: string): string {
  return `${docsPath === '/' ? '' : docsPath}/assets`
}

export function renderHtml(docsPath: string, title: string): string {
  const base = escapeHtml(assetBase(docsPath))
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${base}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${base}/swagger-ui-bundle.js"></script>
    <script src="${base}/init.js"></script>
  </body>
</html>
`
}

export function renderInitScript(jsonPath: string, ui: ResolvedSwaggerUI): string {
  // JSON.stringify yields valid JS literals; this file is a script, never embedded in HTML.
  return `window.addEventListener('load', function () {
  window.ui = SwaggerUIBundle({
    url: ${JSON.stringify(jsonPath)},
    dom_id: '#swagger-ui',
    deepLinking: true,
    persistAuthorization: ${JSON.stringify(ui.persistAuthorization)},
    docExpansion: ${JSON.stringify(ui.docExpansion)},
    validatorUrl: null,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout'
  })
})
`
}

/**
 * Builds the documentation routes. Everything except the (cached on first use)
 * Swagger UI static files is computed once, here: requests never trigger generation.
 */
export function createDocsRoutes(input: {
  readonly docsPath: string | undefined
  readonly jsonPath: string | undefined
  readonly json: string
  readonly ui: ResolvedSwaggerUI
}): DocsRoute[] {
  const routes: DocsRoute[] = []

  if (input.jsonPath !== undefined) {
    const { json } = input
    routes.push({
      path: input.jsonPath,
      handler: () =>
        new Response(json, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache',
            ...SECURITY_HEADERS,
          },
        }),
    })
  }

  if (input.docsPath !== undefined && input.jsonPath !== undefined) {
    const directory = locateSwaggerUiDirectory()
    const base = assetBase(input.docsPath)
    const html = renderHtml(input.docsPath, input.ui.title)
    const init = renderInitScript(input.jsonPath, input.ui)

    routes.push({
      path: input.docsPath,
      handler: () =>
        new Response(html, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-security-policy': CONTENT_SECURITY_POLICY,
            'cache-control': 'no-cache',
            ...SECURITY_HEADERS,
          },
        }),
    })

    routes.push({
      path: `${base}/init.js`,
      handler: () =>
        new Response(init, {
          headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': 'no-cache',
            ...SECURITY_HEADERS,
          },
        }),
    })

    for (const asset of ASSETS) {
      let cached: Promise<Uint8Array> | undefined
      routes.push({
        path: `${base}/${asset.file}`,
        handler: async () => {
          cached ??= readFile(join(directory, asset.file)).catch((error: unknown) => {
            cached = undefined
            throw error
          })
          const data = await cached

          return new Response(new Uint8Array(data), {
            headers: {
              'content-type': asset.type,
              'cache-control': 'private, max-age=3600',
              ...SECURITY_HEADERS,
            },
          })
        },
      })
    }
  }

  return routes
}
