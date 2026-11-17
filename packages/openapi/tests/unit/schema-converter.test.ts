import { describe, expect, spyOn, test } from 'bun:test'
import { Validator, defineSchema, passwordRules, rules } from 'riser-bob'
import { convertSchema, SchemaConversionError } from '../../src/schemas/schema-converter'

const props = (schema: unknown) => convertSchema(schema).objectSchema.properties
const required = (schema: unknown) => convertSchema(schema).objectSchema.required

describe('convertSchema', () => {
  test('converts the documented example (required string + email)', () => {
    const UserSchema = defineSchema({
      name: rules(['required', 'string']),
      email: rules(['required', 'email']),
    })

    expect(convertSchema(UserSchema).objectSchema).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' },
      },
      required: ['name', 'email'],
    })
  })

  test('string, number, boolean', () => {
    expect(
      props({ a: ['required', 'string'], b: ['required', 'number'], c: ['required', 'boolean'] }),
    ).toEqual({
      a: { type: 'string', minLength: 1 },
      b: { type: 'number' },
      c: { type: 'boolean' },
    })
  })

  test('optional fields are not in "required"', () => {
    expect(required({ a: ['nullable', 'string'] })).toBeUndefined()
    expect(required({ a: ['required', 'string'], b: ['nullable', 'number'] })).toEqual(['a'])
  })

  test('nullable uses the OpenAPI 3.1 type array', () => {
    expect(props({ a: ['nullable', 'string'] })['a']).toEqual({ type: ['string', 'null'] })
  })

  test('nullable enum includes null in the enum list', () => {
    expect(props({ a: ['nullable', 'enum:a,b'] })['a']).toEqual({
      type: ['string', 'null'],
      enum: ['a', 'b', null],
    })
  })

  test('string length limits', () => {
    expect(props({ a: ['required', 'string', 'minLength:3', 'maxLength:10'] })['a']).toEqual({
      type: 'string',
      minLength: 3,
      maxLength: 10,
    })
  })

  test('number limits map to minimum / maximum', () => {
    expect(props({ a: ['required', 'number', 'min:1', 'max:5.5'] })['a']).toEqual({
      type: 'number',
      minimum: 1,
      maximum: 5.5,
    })
  })

  test('min / max on a string field are length checks, as in the Validator', () => {
    expect(props({ a: ['nullable', 'string', 'min:2', 'max:8'] })['a']).toEqual({
      type: ['string', 'null'],
      minLength: 2,
      maxLength: 8,
    })
  })

  test('arrays with item limits', () => {
    expect(props({ a: ['required', 'array', 'minItems:1', 'maxItems:5'] })['a']).toEqual({
      type: 'array',
      minItems: 1,
      maxItems: 5,
    })
  })

  test('url is documented as http(s) URI', () => {
    expect(props({ a: ['required', 'url'] })['a']).toEqual({
      type: 'string',
      format: 'uri',
      pattern: '^https?://',
    })
  })

  test('enum trims options', () => {
    expect(props({ a: ['required', 'enum: active , pending'] })['a']).toEqual({
      type: 'string',
      enum: ['active', 'pending'],
    })
  })

  test('confirmed adds the "<field>Confirmation" property the Validator reads', () => {
    const schema = defineSchema({
      password: passwordRules(['required', 'string', 'minLength:8', 'confirmed']),
    })
    const converted = convertSchema(schema).objectSchema

    expect(Object.keys(converted.properties)).toEqual(['password', 'passwordConfirmation'])
    expect(converted.properties['password']).toEqual({ type: 'string', minLength: 8 })
    expect(converted.properties['passwordConfirmation']).toMatchObject({ type: 'string' })
    expect(converted.required).toEqual(['password', 'passwordConfirmation'])
  })

  test('an explicit "<field>Confirmation" wins over the derived one', () => {
    const converted = convertSchema({
      password: ['required', 'string', 'confirmed'],
      passwordConfirmation: ['required', 'string'],
    })
    expect(converted.fields.filter((f) => f.name === 'passwordConfirmation')).toHaveLength(1)
  })

  test('a schema without a type rule is documented as unconstrained', () => {
    expect(props({ a: ['required'] })['a']).toEqual({})
  })

  describe('rejects what it cannot represent (never silently ignored)', () => {
    test.each([
      [{ a: ['required', 'string', 'custom'] }, 'unknown rule "custom"'],
      [{ a: ['required', 'string', 'minLength'] }, 'requires a limit'],
      [{ a: ['required', 'string', 'minLength:x'] }, 'invalid limit'],
      [{ a: ['required', 'string', 'minLength:1.5'] }, 'integer'],
      [{ a: ['required', 'string', 'enum'] }, 'requires options'],
      [{ a: ['required', 'enum'] }, 'requires options'],
      [{ a: ['required', 'enum:a,,b'] }, 'empty or duplicate'],
      [{ a: ['required', 'enum:a,a'] }, 'empty or duplicate'],
      [{ a: ['required', 'string:3'] }, 'does not accept a limit'],
      [{ a: ['required', 'number', 'minLength:2'] }, 'requires a string type rule'],
      [{ a: ['required', 'string', 'minItems:2'] }, 'requires the "array" rule'],
      [{ a: ['required', 'min:2'] }, '"string" or "number"'],
      [{ a: ['required', 'string', 'number'] }, 'incompatible type rules'],
      [{ a: ['required', 'number', 'enum:a,b'] }, 'incompatible type rules'],
      [{ a: ['required', 'nullable', 'string'] }, 'cannot be combined'],
      [{ a: 'required' }, 'rules must be an array'],
      [{ a: ['required', 5] }, 'must be a string'],
      [{ '': ['required'] }, 'invalid field name'],
    ])('%j', (schema, message) => {
      const error = (() => {
        try {
          convertSchema(schema)
          return undefined
        } catch (e) {
          return e
        }
      })()
      expect(error).toBeInstanceOf(SchemaConversionError)
      expect((error as SchemaConversionError).message).toContain(message)
    })

    test.each([[null], [undefined], ['x'], [5], [[]], [[['required']]]])(
      'non-object schema %j',
      (schema) => {
        expect(() => convertSchema(schema)).toThrow(SchemaConversionError)
      },
    )

    test('reports every problem at once', () => {
      try {
        convertSchema({ a: ['required', 'bogus'], b: ['required', 'string', 'min'] })
        throw new Error('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaConversionError)
        expect((error as SchemaConversionError).problems).toHaveLength(2)
      }
    })
  })

  // The converter must agree with the real Validator about which schemas are well-formed.
  describe('agrees with the real Validator', () => {
    const samples: Record<string, unknown>[] = [
      { a: ['required', 'string'] },
      { a: ['required', 'string', 'minLength:3', 'maxLength:9'] },
      { a: ['nullable', 'number', 'min:1', 'max:5'] },
      { a: ['required', 'array', 'maxItems:3'] },
      { a: ['required', 'enum:x,y'] },
      { a: ['required', 'url'] },
      { a: ['required', 'email'] },
      { a: ['required', 'bogus'] },
      { a: ['required', 'string', 'minLength'] },
      { a: ['required', 'nullable', 'string'] },
      { a: ['required', 'enum:a,a'] },
      { a: ['required', 'string:3'] },
    ]

    test.each(samples)('%j', (schema) => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
      const validatorThrows = (() => {
        try {
          Validator.validate({}, schema as never)
          return false
        } catch {
          return true
        } finally {
          errorSpy.mockRestore()
        }
      })()
      const converterThrows = (() => {
        try {
          convertSchema(schema)
          return false
        } catch {
          return true
        }
      })()
      expect(converterThrows).toBe(validatorThrows)
    })

    test('a payload accepted by the Validator satisfies the generated limits', () => {
      const schema = {
        age: ['required', 'number', 'min:18', 'max:65'],
        name: ['required', 'string', 'minLength:2'],
      } as const
      const { objectSchema } = convertSchema(schema)

      expect(Validator.validate({ age: 17, name: 'ab' }, schema as never).valid).toBe(false)
      expect(objectSchema.properties['age']).toMatchObject({ minimum: 18, maximum: 65 })
      expect(Validator.validate({ age: 30, name: 'ab' }, schema as never).valid).toBe(true)
      expect(Validator.validate({ age: 30, name: '' }, schema as never).valid).toBe(false)
      expect(objectSchema.properties['name']).toMatchObject({ minLength: 2 })
    })
  })
})
