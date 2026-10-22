import { HttpError } from '../errors/http-error'

export const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MiB

export const readRequestBody = async (
	request: Request,
	maxBodySize = DEFAULT_MAX_BODY_SIZE
): Promise<Uint8Array> => {
	const contentLength = request.headers.get('content-length')

	if (contentLength !== null) {
		const declaredSize = Number(contentLength)

		if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
			throw new HttpError(400, 'Invalid Content-Length')
		}

		if (declaredSize > maxBodySize) {
			throw new HttpError(413, 'Content Too Large')
		}
	}

	if (!request.body) {
		return new Uint8Array()
	}

	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let totalSize = 0

	try {
		while (true) {
			const { done, value } = await reader.read()

			if (done) break

			totalSize += value.byteLength

			if (totalSize > maxBodySize) {
				await reader.cancel().catch(() => {})
				throw new HttpError(413, 'Content Too Large')
			}

			chunks.push(value)
		}
	} catch (error) {
		await reader.cancel().catch(() => {})
		throw error
	} finally {
		reader.releaseLock()
	}

	const body = new Uint8Array(totalSize)
	let offset = 0

	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.byteLength
	}

	return body
}
