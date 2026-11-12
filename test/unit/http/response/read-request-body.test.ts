import { describe, expect, test } from 'bun:test'
import { readRequestBody } from '../../../../src/http/read-request-body'

const createRequest = (body?: BodyInit | null, headers?: HeadersInit): Request => {
  return new Request('http://localhost/test', {
    method: 'POST',
    body,
    headers,
  })
}

describe('readRequestBody', () => {
  test('should return an empty Uint8Array for an empty body', async () => {
    const request = createRequest(null)

    const result = await readRequestBody(request)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.byteLength).toBe(0)
  })

  test('should read a body smaller than 64KB', async () => {
    const original = 'A'.repeat(10 * 1024)
    const request = createRequest(original)

    const result = await readRequestBody(request)

    expect(result.byteLength).toBe(original.length)
    expect(new TextDecoder().decode(result)).toBe(original)
  })

  test('should read a body larger than 64KB', async () => {
    const original = 'B'.repeat(100 * 1024)
    const request = createRequest(original)

    const result = await readRequestBody(request)

    expect(result.byteLength).toBe(original.length)
    expect(new TextDecoder().decode(result)).toBe(original)
  })

  test('should read a body of approximately 450KB', async () => {
    const original = 'C'.repeat(450 * 1024)
    const request = createRequest(original)

    const result = await readRequestBody(request)

    expect(result.byteLength).toBe(original.length)
    expect(new TextDecoder().decode(result)).toBe(original)
  })

  test('should reject a body exceeding maxBodySize with Content-Length', async () => {
    const maxBodySize = 1024
    const original = 'D'.repeat(2048)

    const request = createRequest(original)

    await expect(readRequestBody(request, maxBodySize)).rejects.toMatchObject({
      status: 413,
      message: 'Content Too Large',
    })
  })

  test('should reject a body exceeding maxBodySize without Content-Length', async () => {
    const maxBodySize = 1024
    const original = 'E'.repeat(2048)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(original))
        controller.close()
      },
    })

    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: stream,
      // Intentionally omit Content-Length
      // @ts-expect-error Bun/Node RequestInit supports duplex for streams
      duplex: 'half',
    })

    await expect(readRequestBody(request, maxBodySize)).rejects.toMatchObject({
      status: 413,
      message: 'Content Too Large',
    })
  })

  test('should preserve the complete data after multiple buffer expansions', async () => {
    const encoder = new TextEncoder()

    const parts = [
      'First chunk - ',
      'A'.repeat(70 * 1024),
      ' - Second chunk - ',
      'B'.repeat(150 * 1024),
      ' - Third chunk - ',
      'C'.repeat(230 * 1024),
      ' - Final chunk',
    ]

    const original = parts.join('')

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(encoder.encode(part))
        }

        controller.close()
      },
    })

    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: stream,
      // @ts-expect-error Bun/Node RequestInit supports duplex for streams
      duplex: 'half',
    })

    const result = await readRequestBody(request)

    expect(result.byteLength).toBe(encoder.encode(original).byteLength)
    expect(new TextDecoder().decode(result)).toBe(original)
  })
})
