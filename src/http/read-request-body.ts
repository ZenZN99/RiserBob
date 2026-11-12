import { HttpError } from '../errors/http-error'

export const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MiB

export const readRequestBody = async (
  request: Request,
  maxBodySize = DEFAULT_MAX_BODY_SIZE,
): Promise<Uint8Array> => {
  const contentLength = request.headers.get('content-length')

  let declaredSize: number | null = null

  if (contentLength !== null) {
    declaredSize = Number(contentLength)

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

  let capacity = declaredSize ?? Math.min(64 * 1024, maxBodySize)
  let body = new Uint8Array(capacity)
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      const chunkSize = value.byteLength
      const nextSize = totalSize + chunkSize

      if (nextSize > maxBodySize) {
        throw new HttpError(413, 'Content Too Large')
      }

      if (nextSize > capacity) {
        const nextCapacity = Math.min(
          maxBodySize,
          Math.max(nextSize, capacity === 0 ? 1 : capacity * 2),
        )

        const nextBody = new Uint8Array(nextCapacity)
        nextBody.set(body.subarray(0, totalSize))

        body = nextBody
        capacity = nextCapacity
      }

      body.set(value, totalSize)
      totalSize = nextSize
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }

  return body.subarray(0, totalSize)
}
