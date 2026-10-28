import { CookieManager } from '@riser-bob/cookie'
import { ErrorHandler } from '../errors/error-handler'
import type { SpongMiddleware } from '../types/spong-middleware'
import type { SpongRequest } from '../types/spong-request'

interface VerifiedUser {
	id: string
	[key: string]: unknown
}

type TokenVerifier = (
	token: string
) => Promise<VerifiedUser | null> | VerifiedUser | null

export type AuthMode = 'cookie' | 'bearer' | 'both'

type CookieAuthOptions = {
	mode: 'cookie'
	cookieName: string
}

type BearerAuthOptions = {
	mode: 'bearer'
}

type BothAuthOptions = {
	mode: 'both'
	cookieName?: string
}

export type AuthMiddlewareOptions =
	| CookieAuthOptions
	| BearerAuthOptions
	| BothAuthOptions

export class AuthMiddleware {
	private readonly mode: AuthMode
	private readonly cookieName: string

	constructor(
		private readonly verifyToken: TokenVerifier,
		options: AuthMiddlewareOptions = { mode: 'both' }
	) {
		this.mode = options.mode
		this.cookieName =
			options.mode === 'cookie' || options.mode === 'both'
				? (options.cookieName ?? 'token')
				: 'token'
	}

	private getToken(spongReq: SpongRequest): string | null {
		if (this.mode === 'bearer' || this.mode === 'both') {
			const authorization = spongReq.headers.get('authorization')

			if (authorization) {
				const match = authorization.match(/^Bearer\s+(\S+)$/i)

				if (!match) return null

				return match[1] ?? null
			}

			if (this.mode === 'bearer') return null
		}

		if (this.mode === 'cookie' || this.mode === 'both') {
			const cookies = CookieManager.fromRequest(spongReq.request)

			return cookies.get(this.cookieName) ?? null
		}

		return null
	}

	middleware: SpongMiddleware<SpongRequest> = async (
		spongReq,
		spongRes,
		spongNext
	) => {
		const token = this.getToken(spongReq)

		if (!token) {
			return spongRes.SpongUnauthorized({
				success: false,
				message: 'Authentication token is missing or invalid.'
			})
		}

		let user: VerifiedUser | null

		try {
			user = await this.verifyToken(token)
		} catch (error) {
			console.error('[RiserBob] Token verification failed:', error)
			return ErrorHandler.handle(error)
		}

		if (!user) {
			return spongRes.SpongUnauthorized({
				success: false,
				message: 'Token is invalid or expired.'
			})
		}

		spongReq.user = user
		spongReq.auth = { token }

		return spongNext()
	}
}
