export function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) return error.message
	if (typeof error === 'object' && error !== null && 'message' in error) {
		const { message } = error
		if (typeof message === 'string' && message) return message
	}
	return fallback
}
