import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { Validator, defineSchema, rules } from '../../../src/validation/validator'
import type { ValidationSchema, ValidationResult } from '../../../src/validation/validator'

type ValidatorInternals = {
  parseSchema: (schema: ValidationSchema) => unknown
}

const internals = Validator as unknown as ValidatorInternals

function makeSchema() {
  return defineSchema({
    username: rules(['required', 'string', 'minLength:3', 'maxLength:20']),
    age: rules(['required', 'number', 'min:18', 'max:100']),
    role: rules(['required', 'enum:admin,user,moderator']),
    website: rules(['nullable', 'url']),
  })
}

const validBody = { username: 'zen', age: 30, role: 'admin', website: null }

describe('Validator schema cache', () => {
  const spies: Array<{ mockRestore: () => void }> = []
  afterEach(() => {
    while (spies.length > 0) spies.pop()?.mockRestore()
  })

  function spyParse() {
    const spy = spyOn(internals, 'parseSchema')
    spies.push(spy)
    return spy
  }

  test('first validate() with a new schema parses exactly once', () => {
    const spy = spyParse()
    const schema = makeSchema()

    expect(Validator.validate(validBody, schema).valid).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('later calls with the same schema do not parse again (valid and invalid data)', () => {
    const spy = spyParse()
    const schema = makeSchema()

    Validator.validate(validBody, schema)
    for (let i = 0; i < 100; i++) Validator.validate(validBody, schema)
    for (let i = 0; i < 100; i++) Validator.validate({ username: 'x' }, schema)

    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('different schemas are parsed and cached independently', () => {
    const spy = spyParse()
    const a = makeSchema()
    const b = makeSchema()
    const c = defineSchema({ email: rules(['required', 'email']) })

    Validator.validate(validBody, a)
    Validator.validate(validBody, b)
    Validator.validate({ email: 'a@b.co' }, c)
    expect(spy).toHaveBeenCalledTimes(3)

    Validator.validate(validBody, a)
    Validator.validate(validBody, b)
    Validator.validate({ email: 'a@b.co' }, c)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  test('results and messages are the same on cache miss and cache hit', () => {
    const schema = makeSchema()
    const bad = {
      username: 'ab',
      age: 10,
      role: 'guest',
      website: 'ftp://x.com',
    }

    const first = Validator.validate(bad, schema)
    const second = Validator.validate(bad, schema)

    const expected: ValidationResult<unknown> = {
      valid: false,
      errors: {
        username: ['username must be at least 3 characters'],
        age: ['age must be at least 18'],
        role: ['role must be one of: admin, user, moderator'],
        website: ['website URL must use http or https'],
      },
    }

    expect(first).toEqual(expected)
    expect(second).toEqual(expected)

    expect(Object.keys(second.errors)).toEqual(['username', 'age', 'role', 'website'])

    expect(Validator.validate(validBody, schema)).toEqual({
      valid: true,
      data: validBody,
      errors: {},
    })
  })

  test('an invalid schema is NOT cached: it throws every time', () => {
    const spy = spyParse()
    const logSpy = spyOn(console, 'error').mockImplementation(() => {})
    spies.push(logSpy)
    const bad = { name: ['required', 'nullable', 'string'] } as unknown as ValidationSchema

    expect(() => Validator.validate({ name: 'x' }, bad)).toThrow(
      '[RiserBob] Invalid rules for field "name".',
    )
    expect(() => Validator.validate({ name: 'x' }, bad)).toThrow(
      '[RiserBob] Invalid rules for field "name".',
    )
    expect(spy).toHaveBeenCalledTimes(2)
  })

  test('non-object schemas behave as before (no WeakMap key error)', () => {
    expect(Validator.validate({}, 5 as unknown as ValidationSchema)).toEqual({
      valid: true,
      data: {},
      errors: {},
    })
    expect(() => Validator.validate({}, null as unknown as ValidationSchema)).toThrow(TypeError)
  })

  test('cache does not keep schemas alive (no memory leak)', async () => {
    const refs: WeakRef<object>[] = []

    const fill = () => {
      for (let i = 0; i < 2000; i++) {
        const schema = makeSchema()
        Validator.validate(validBody, schema)
        refs.push(new WeakRef(schema))
      }
    }
    fill()

    await new Promise((resolve) => setTimeout(resolve, 0))
    Bun.gc(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    Bun.gc(true)

    const alive = refs.filter((ref) => ref.deref() !== undefined).length
    console.log(`  schemas still alive after GC: ${alive} / ${refs.length}`)
    expect(alive).toBeLessThan(refs.length * 0.05)
  })

  test('heap stays flat when many one-off schemas are validated', () => {
    Bun.gc(true)
    const before = process.memoryUsage().heapUsed

    for (let i = 0; i < 50_000; i++) Validator.validate(validBody, makeSchema())

    Bun.gc(true)
    const growthMb = (process.memoryUsage().heapUsed - before) / 1024 / 1024
    console.log(`  heap growth after 50k one-off schemas: ${growthMb.toFixed(2)} MB`)
    expect(growthMb).toBeLessThan(10)
  })

  describe('mutating a schema after its first validate() (documented limit)', () => {
    test('a NEW schema object always reflects the change', () => {
      const original = makeSchema()
      expect(Validator.validate({ ...validBody, age: 20 }, original).valid).toBe(true)

      const changed = { ...original, age: rules(['required', 'number', 'min:25']) }
      expect(Validator.validate({ ...validBody, age: 20 }, changed).valid).toBe(false)
    })

    test('in-place mutation of an already-validated schema is NOT detected', () => {
      const schema = makeSchema()
      const body = { ...validBody, age: 20 }
      expect(Validator.validate(body, schema).valid).toBe(true)
      ;(schema.age as unknown as string[])[2] = 'min:25'

      // Limit of the identity-only cache: the stale parsed result is reused.
      expect(Validator.validate(body, schema).valid).toBe(true)
    })

    test('adding a field in place is NOT detected either', () => {
      const schema = makeSchema() as Record<string, readonly string[]>
      Validator.validate(validBody, schema as ValidationSchema)

      schema.extra = rules(['required', 'string'])

      expect(Validator.validate(validBody, schema as ValidationSchema).valid).toBe(true)
    })
  })
})
