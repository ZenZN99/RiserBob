import { describe, expect, spyOn, test } from 'bun:test'
import { Validator as Cached } from '../../../src/validation/validator'
import { Validator as Original } from '../../../src/validation/validator'
import type { ValidationSchema } from '../../../src/validation/validator'

// Deterministic PRNG so failures are reproducible.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(20260512)
const pick = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T

const TYPES = ['string', 'number', 'boolean', 'array', 'email', 'url', 'enum:a,b,c', 'enum: x , y ']
const LIMITS = ['min', 'max', 'minLength', 'maxLength', 'minItems', 'maxItems']
const BROKEN = [
  'bogus',
  'min',
  'min:abc',
  'min:1.5x',
  'minLength:2.5',
  'enum',
  'enum:a,,b',
  'enum:a,a',
  'string:1',
  5,
  null,
]

function randomRules(): unknown[] {
  const out: unknown[] = []
  const r = rnd()
  if (r < 0.45) out.push('required')
  else if (r < 0.85) out.push('nullable')
  else if (r < 0.9) out.push('required', 'nullable') // invalid on purpose
  if (rnd() < 0.9) out.push(pick(TYPES))
  const n = Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) out.push(`${pick(LIMITS)}:${pick([0, 1, 3, 10, 18])}`)
  if (rnd() < 0.15) out.push('confirmed')
  if (rnd() < 0.07) out.push(pick(BROKEN))
  return out
}

const FIELDS = ['f1', 'f2', 'f3', 'password', 'f5']
function randomSchema(): ValidationSchema {
  const schema: Record<string, unknown> = {}
  const count = 1 + Math.floor(rnd() * 5)
  for (let i = 0; i < count; i++) schema[FIELDS[i] as string] = randomRules()
  if (rnd() < 0.03) schema.broken = 'not-an-array'
  return schema as unknown as ValidationSchema
}

const VALUES: unknown[] = [
  undefined,
  null,
  '',
  '   ',
  'abc',
  'a@b.co',
  'bad@',
  'https://example.com',
  'ftp://x.com',
  'http://',
  'a',
  'b',
  'x',
  'y',
  'zzzzzzzzzzzzzzzzzzzzzzzz',
  0,
  5,
  18,
  99,
  -1,
  1.5,
  NaN,
  Infinity,
  true,
  false,
  [],
  ['a'],
  [1, 2, 3],
  new Array(11).fill('x'),
  {},
  { a: 1 },
]

function randomData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of [...FIELDS, 'broken']) {
    if (rnd() < 0.85) data[f] = pick(VALUES)
    const conf = rnd()
    if (conf < 0.3) data[`${f}Confirmation`] = data[f]
    else if (conf < 0.5) data[`${f}Confirmation`] = pick(VALUES)
  }
  return data
}

function outcome(fn: () => unknown): string {
  try {
    return (
      'ok:' +
      JSON.stringify(fn(), (_k, v) =>
        typeof v === 'number' && !Number.isFinite(v) ? String(v) : v,
      )
    )
  } catch (error) {
    return `throw:${(error as Error).constructor.name}:${(error as Error).message}`
  }
}

describe('cached Validator is identical to the original', () => {
  test('5000 random schemas x 6 payloads each (schema reused across payloads => cache hits)', () => {
    spyOn(console, 'error').mockImplementation(() => {})
    let compared = 0
    let threw = 0
    let invalid = 0

    for (let s = 0; s < 5000; s++) {
      const schema = randomSchema()
      for (let d = 0; d < 6; d++) {
        const data = randomData()
        const expected = outcome(() => Original.validate(data, schema))
        const actual = outcome(() => Cached.validate(data, schema))
        expect(actual).toBe(expected)
        compared++
        if (expected.startsWith('throw:')) threw++
        else if (expected.includes('"valid":false')) invalid++
      }
    }
    console.log(
      `  compared=${compared} (threw=${threw}, invalid=${invalid}, valid=${compared - threw - invalid})`,
    )
    expect(compared).toBe(30000)
  })
})
