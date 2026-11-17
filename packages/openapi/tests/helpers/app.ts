import type { SpongHandler } from 'riser-bob'
import { RiserBob } from 'riser-bob'
import type { OpenAPIOptions } from '../../src/index.js'

export const ok: SpongHandler = () => new Response('OK')

export function createApp(
  routes: ReadonlyArray<readonly ['GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD', string]>,
): RiserBob {
  const bob = new RiserBob()
  for (const [method, path] of routes) {
    switch (method) {
      case 'GET':
        bob.spongGet(path, ok)
        break
      case 'POST':
        bob.spongPost(path, ok)
        break
      case 'PUT':
        bob.spongPut(path, ok)
        break
      case 'PATCH':
        bob.spongPatch(path, ok)
        break
      case 'DELETE':
        bob.spongDelete(path, ok)
        break
      case 'HEAD':
        bob.spongHead(path, ok)
        break
    }
  }
  return bob
}

export const baseInfo = { title: 'Test API', version: '1.0.0' } as const

export function options(overrides: Partial<OpenAPIOptions> = {}): OpenAPIOptions {
  return { info: { ...baseInfo }, routes: {}, ...overrides }
}

/** Runs `fn` and returns the thrown error (fails the test if nothing is thrown). */
export function catchError(fn: () => unknown): Error {
  try {
    fn()
  } catch (error) {
    if (error instanceof Error) return error
    throw new Error(`Non-error thrown: ${String(error)}`)
  }
  throw new Error('Expected function to throw')
}
