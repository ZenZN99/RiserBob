import type { SpongAuth } from './spong-auth'

export interface AuthenticationUser {
	id: string
	[key: string]: unknown
}

export interface SpongRequest<
	TUser extends AuthenticationUser = AuthenticationUser
> {
	readonly request: Request
	readonly method: string
	readonly url: URL
	readonly path: string
	readonly params: Record<string, string>
	readonly query: URLSearchParams
	readonly headers: Headers

	user?: TUser
	auth?: SpongAuth

	json<T = unknown>(): Promise<T>
	formData(): ReturnType<Response['formData']>
	text(): Promise<string>
}
