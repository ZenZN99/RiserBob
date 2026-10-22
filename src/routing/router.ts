import type { SpongHandler } from '../types/spong-handler'
import { SpongMethod, type HttpMethod } from '../types/spong-method'

export class Router {
	private routes = new Map<string, SpongHandler>()

	register(method: HttpMethod, path: string, handler: SpongHandler): this {
		const key = `${method} ${path}`

		if (this.routes.has(key)) {
			throw new Error(
				`🍍 Oh, barnacles! Route "${key}" already lives in Bikini Bottom! 🧽`
			)
		}

		this.routes.set(key, handler)
		return this
	}

	private matchPath(
		routePath: string,
		requestPath: string
	): Record<string, string> | undefined {
		const routeParts = routePath.split('/').filter(Boolean)
		const requestParts = requestPath.split('/').filter(Boolean)

		if (routeParts.length !== requestParts.length) {
			return undefined
		}

		const params: Record<string, string> = {}

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

				try {
					params[paramName] = decodeURIComponent(requestPart)
				} catch {
					return undefined
				}
			} else if (routePart !== requestPart) {
				return undefined
			}
		}

		return params
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

	match(
		method: string,
		path: string
	):
		| {
				handler: SpongHandler
				params: Record<string, string>
		  }
		| undefined {
		const entries = [...this.routes.entries()]
			.filter(([key]) => key.startsWith(`${method} `))
			.sort(([a], [b]) => {
				const aPath = a.slice(method.length + 1)
				const bPath = b.slice(method.length + 1)

				return this.compareRoutes(aPath, bPath)
			})

		for (const [key, handler] of entries) {
			const routePath = key.slice(method.length + 1)
			const params = this.matchPath(routePath, path)

			if (params !== undefined) {
				return { handler, params }
			}
		}

		return undefined
	}

	allowedMethods(path: string): HttpMethod[] {
		const methods: HttpMethod[] = [
			SpongMethod.GET,
			SpongMethod.POST,
			SpongMethod.PUT,
			SpongMethod.PATCH,
			SpongMethod.DELETE
		]

		return methods.filter((method) => this.routes.has(`${method} ${path}`))
	}
}
