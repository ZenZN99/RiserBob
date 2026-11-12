import { describe, expect, test } from 'bun:test'
import {
  defineSchema,
  passwordRules,
  rules,
  Validator,
  type FieldRules,
  type ValidationSchema,
} from '../../../src/validation/validator'

/*
 * Compile-time + runtime tests for the Validator type system.
 *
 * Every `@ts-expect-error` line MUST produce a TypeScript error: if the type
 * system ever stops rejecting that case, `tsc` reports "Unused '@ts-expect-error'
 * directive" and the type check fails. Run them with:  bunx tsc --noEmit
 *
 * Keep each `@ts-expect-error` and the line it guards on single lines: the
 * directive only applies to the next line.
 *
 * The `expect(...)` calls make the runtime part of each test meaningful:
 * the helpers are identity functions and must never change a schema.
 */

describe('Validator types', () => {
  describe('field order: required | nullable first', () => {
    test('accepts required and nullable as the first rule', () => {
      const schema = defineSchema({
        a: ['required', 'string'],
        b: ['nullable', 'string'],
      })

      expect(schema.a).toEqual(['required', 'string'])
      expect(schema.b).toEqual(['nullable', 'string'])
    })

    test('rejects a type as the first rule', () => {
      defineSchema({
        // @ts-expect-error the first rule must be required | nullable
        a: ['string'],
        // @ts-expect-error the first rule must be required | nullable
        b: ['number', 'min:1'],
        // @ts-expect-error the first rule must be required | nullable
        c: ['email'],
        // @ts-expect-error the first rule must be required | nullable
        d: ['enum:a,b'],
      })

      expect(true).toBe(true)
    })

    test('rejects the type before required / nullable', () => {
      defineSchema({
        // @ts-expect-error required must come before the type
        a: ['string', 'required'],
        // @ts-expect-error nullable must come before the type
        b: ['number', 'nullable'],
        // @ts-expect-error required must come before the type
        c: ['enum:a,b', 'required'],
      })

      expect(true).toBe(true)
    })

    test('rejects required and nullable together', () => {
      defineSchema({
        // @ts-expect-error only one of required | nullable
        a: ['required', 'nullable', 'string'],
      })

      expect(true).toBe(true)
    })

    test('rejects an empty or incomplete rules list', () => {
      defineSchema({
        // @ts-expect-error a field needs a type
        a: [],
        // @ts-expect-error a field needs a type
        b: ['required'],
      })

      expect(true).toBe(true)
    })
  })

  describe('string', () => {
    test('accepts every valid combination', () => {
      const schema: ValidationSchema = {
        a: ['required', 'string'],
        b: ['required', 'string', 'minLength:3'],
        c: ['required', 'string', 'maxLength:20'],
        d: ['required', 'string', 'minLength:3', 'maxLength:20'],
        e: ['required', 'string', 'maxLength:20', 'minLength:3'],
        f: ['nullable', 'string', 'minLength:3'],
      }

      expect(Object.keys(schema)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    })

    test('rejects duplicated limits', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error minLength cannot be repeated
        a: ['required', 'string', 'minLength:3', 'minLength:4'],
        // @ts-expect-error maxLength cannot be repeated
        b: ['required', 'string', 'maxLength:3', 'maxLength:4'],
        // @ts-expect-error a limit cannot follow both limits
        c: ['required', 'string', 'minLength:3', 'maxLength:4', 'minLength:5'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects rules of other types', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error min belongs to number
        a: ['required', 'string', 'min:3'],
        // @ts-expect-error max belongs to number
        b: ['required', 'string', 'max:3'],
        // @ts-expect-error minItems belongs to array
        c: ['required', 'string', 'minItems:1'],
        // @ts-expect-error maxItems belongs to array
        d: ['required', 'string', 'maxItems:1'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects a second type after string', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error only one type per field
        a: ['required', 'string', 'number'],
        // @ts-expect-error only one type per field
        b: ['required', 'string', 'enum:a,b'],
      }

      expect(schema).toBeDefined()
    })
  })

  describe('number', () => {
    test('accepts every valid combination', () => {
      const schema: ValidationSchema = {
        a: ['required', 'number'],
        b: ['required', 'number', 'min:18'],
        c: ['required', 'number', 'max:100'],
        d: ['required', 'number', 'min:18', 'max:100'],
        e: ['required', 'number', 'max:100', 'min:18'],
        f: ['nullable', 'number', 'max:100'],
      }

      expect(Object.keys(schema)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    })

    test('rejects duplicated limits', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error min cannot be repeated
        a: ['required', 'number', 'min:1', 'min:2'],
        // @ts-expect-error max cannot be repeated
        b: ['required', 'number', 'max:1', 'max:2'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects rules of other types', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error minLength belongs to string
        a: ['required', 'number', 'minLength:3'],
        // @ts-expect-error maxLength belongs to string
        b: ['required', 'number', 'maxLength:3'],
        // @ts-expect-error minItems belongs to array
        c: ['required', 'number', 'minItems:1'],
      }

      expect(schema).toBeDefined()
    })
  })

  describe('array', () => {
    test('accepts maxItems with an optional minItems, in any order', () => {
      const schema: ValidationSchema = {
        a: ['required', 'array', 'maxItems:10'],
        b: ['required', 'array', 'minItems:1', 'maxItems:10'],
        c: ['required', 'array', 'maxItems:10', 'minItems:1'],
        d: ['nullable', 'array', 'maxItems:10'],
      }

      expect(Object.keys(schema)).toEqual(['a', 'b', 'c', 'd'])
    })

    test('requires maxItems', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error maxItems is required for arrays
        a: ['required', 'array'],
        // @ts-expect-error maxItems is required for arrays
        b: ['required', 'array', 'minItems:1'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects duplicated limits', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error maxItems cannot be repeated
        a: ['required', 'array', 'maxItems:1', 'maxItems:2'],
        // @ts-expect-error minItems cannot be repeated
        b: ['required', 'array', 'minItems:1', 'minItems:2', 'maxItems:3'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects rules of other types', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error minLength belongs to string
        a: ['required', 'array', 'minLength:1'],
        // @ts-expect-error min belongs to number
        b: ['required', 'array', 'min:1'],
      }

      expect(schema).toBeDefined()
    })
  })

  describe('boolean, email and url', () => {
    test('accepts them on their own', () => {
      const schema: ValidationSchema = {
        isActive: ['required', 'boolean'],
        email: ['required', 'email'],
        website: ['nullable', 'url'],
      }

      expect(Object.keys(schema)).toEqual(['isActive', 'email', 'website'])
    })

    test('rejects any rule after boolean', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error nothing may follow boolean
        a: ['required', 'boolean', 'min:1'],
        // @ts-expect-error nothing may follow boolean
        b: ['required', 'boolean', 'string'],
        // @ts-expect-error nothing may follow boolean
        c: ['required', 'boolean', 'maxLength:1'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects any rule after email', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error nothing may follow email
        a: ['required', 'email', 'minLength:5'],
        // @ts-expect-error nothing may follow email
        b: ['required', 'email', 'string'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects any rule after url', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error nothing may follow url
        a: ['required', 'url', 'maxLength:100'],
        // @ts-expect-error nothing may follow url
        b: ['required', 'url', 'string'],
      }

      expect(schema).toBeDefined()
    })
  })

  describe('enum', () => {
    test('accepts enum right after required / nullable', () => {
      const schema: ValidationSchema = {
        a: ['required', 'enum:active,pending,completed'],
        b: ['nullable', 'enum:active,pending'],
        c: ['required', 'enum:a,b'],
        d: ['required', 'enum:single'],
        e: ['required', 'enum:active, pending'],
      }

      expect(Object.keys(schema)).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    test('keeps the written options untouched', () => {
      const schema = defineSchema({
        status: ['required', 'enum:active,pending,completed'],
      })

      expect(schema.status).toEqual(['required', 'enum:active,pending,completed'])
    })

    test('rejects any type after enum', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error nothing may follow enum
        a: ['required', 'enum:active,pending', 'string'],
        // @ts-expect-error nothing may follow enum
        b: ['required', 'enum:active,pending', 'number'],
        // @ts-expect-error nothing may follow enum
        c: ['required', 'enum:active,pending', 'boolean'],
        // @ts-expect-error nothing may follow enum
        d: ['required', 'enum:active,pending', 'email'],
        // @ts-expect-error nothing may follow enum
        e: ['required', 'enum:active,pending', 'url'],
        // @ts-expect-error nothing may follow enum
        f: ['required', 'enum:active,pending', 'array'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects any limit after enum', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error nothing may follow enum
        a: ['required', 'enum:active,pending', 'minLength:1'],
        // @ts-expect-error nothing may follow enum
        b: ['required', 'enum:active,pending', 'maxLength:10'],
        // @ts-expect-error nothing may follow enum
        c: ['required', 'enum:active,pending', 'min:1'],
        // @ts-expect-error nothing may follow enum
        d: ['required', 'enum:active,pending', 'max:10'],
        // @ts-expect-error nothing may follow enum
        e: ['required', 'enum:active,pending', 'minItems:1'],
        // @ts-expect-error nothing may follow enum
        f: ['required', 'enum:active,pending', 'maxItems:10'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects required, nullable, another enum and confirmed after enum', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error nothing may follow enum
        a: ['required', 'enum:active,pending', 'required'],
        // @ts-expect-error nothing may follow enum
        b: ['required', 'enum:active,pending', 'nullable'],
        // @ts-expect-error nothing may follow enum
        c: ['required', 'enum:active,pending', 'enum:a,b'],
        // @ts-expect-error nothing may follow enum
        d: ['required', 'enum:active,pending', 'confirmed'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects a type before enum', () => {
      const schema: ValidationSchema = {
        // @ts-expect-error enum must come right after required | nullable
        a: ['required', 'string', 'enum:a,b'],
        // @ts-expect-error enum must come right after required | nullable
        b: ['required', 'number', 'enum:a,b'],
      }

      expect(schema).toBeDefined()
    })

    test('rejects confirmed after enum, even for password', () => {
      defineSchema({
        // @ts-expect-error nothing may follow enum
        password: ['required', 'enum:a,b', 'confirmed'],
      })

      expect(true).toBe(true)
    })
  })

  describe('confirmed', () => {
    test('is accepted for password after minLength and/or maxLength', () => {
      const schema = defineSchema({
        password: ['required', 'string', 'minLength:8', 'maxLength:40', 'confirmed'],
      })

      defineSchema({
        password: ['required', 'string', 'minLength:8', 'confirmed'],
      })
      defineSchema({
        password: ['required', 'string', 'maxLength:40', 'confirmed'],
      })
      defineSchema({
        password: ['nullable', 'string', 'maxLength:40', 'minLength:8', 'confirmed'],
      })

      expect(schema.password).toEqual([
        'required',
        'string',
        'minLength:8',
        'maxLength:40',
        'confirmed',
      ])
    })

    test('is optional for password', () => {
      defineSchema({ password: ['required', 'string'] })
      defineSchema({ password: ['required', 'string', 'minLength:8'] })

      expect(true).toBe(true)
    })

    test('is rejected for every field that is not password', () => {
      defineSchema({
        // @ts-expect-error confirmed is for password only
        username: ['required', 'string', 'confirmed'],
        // @ts-expect-error confirmed is for password only
        username2: ['required', 'string', 'minLength:3', 'confirmed'],
        // @ts-expect-error confirmed is for password only
        username3: ['required', 'string', 'minLength:3', 'maxLength:20', 'confirmed'],
        // @ts-expect-error confirmed is for password only
        email: ['required', 'email', 'confirmed'],
        // @ts-expect-error confirmed is for password only
        age: ['required', 'number', 'confirmed'],
        // @ts-expect-error confirmed is for password only
        active: ['required', 'boolean', 'confirmed'],
        // @ts-expect-error confirmed is for password only
        status: ['required', 'enum:a,b', 'confirmed'],
      })

      expect(true).toBe(true)
    })

    test('must come after minLength / maxLength, as the last rule', () => {
      defineSchema({
        // @ts-expect-error confirmed needs minLength or maxLength first
        a: ['required', 'string', 'confirmed'],
      })
      defineSchema({
        // @ts-expect-error confirmed must be the last rule
        password: ['required', 'string', 'confirmed', 'minLength:8'],
      })
      defineSchema({
        // @ts-expect-error confirmed cannot be repeated
        password: ['required', 'string', 'minLength:8', 'confirmed', 'confirmed'],
      })

      expect(true).toBe(true)
    })

    test('is rejected for password when the type is not string', () => {
      defineSchema({
        // @ts-expect-error confirmed only follows string limits
        password: ['required', 'number', 'min:1', 'confirmed'],
      })

      expect(true).toBe(true)
    })
  })

  describe('rules()', () => {
    test('returns the rules untouched', () => {
      const value = rules(['required', 'string', 'minLength:3'])

      expect(value).toEqual(['required', 'string', 'minLength:3'])
    })

    test('accepts valid rules for every type', () => {
      defineSchema({
        a: rules(['required', 'string', 'minLength:3', 'maxLength:20']),
        b: rules(['required', 'number', 'max:100', 'min:1']),
        c: rules(['required', 'array', 'maxItems:10']),
        d: rules(['required', 'array', 'minItems:1', 'maxItems:10']),
        e: rules(['required', 'boolean']),
        f: rules(['required', 'email']),
        g: rules(['nullable', 'url']),
        h: rules(['required', 'enum:active,pending']),
        i: rules(['nullable', 'enum:a,b']),
      })

      expect(true).toBe(true)
    })

    test('rejects rules that do not fit the previous ones', () => {
      // @ts-expect-error the first rule must be required | nullable
      rules(['string'])
      // @ts-expect-error min does not belong to string
      rules(['required', 'string', 'min:5'])
      // @ts-expect-error minLength does not belong to number
      rules(['required', 'number', 'minLength:5'])
      // @ts-expect-error minLength cannot be repeated
      rules(['required', 'string', 'minLength:8', 'minLength:9'])
      // @ts-expect-error nothing may follow boolean
      rules(['required', 'boolean', 'min:1'])
      // @ts-expect-error nothing may follow email
      rules(['required', 'email', 'minLength:5'])
      // @ts-expect-error nothing may follow url
      rules(['required', 'url', 'maxLength:100'])

      expect(true).toBe(true)
    })

    test('rejects anything after enum', () => {
      // @ts-expect-error nothing may follow enum
      rules(['required', 'enum:a,b', 'string'])
      // @ts-expect-error nothing may follow enum
      rules(['required', 'enum:a,b', 'minLength:1'])
      // @ts-expect-error nothing may follow enum
      rules(['required', 'enum:a,b', 'min:1'])
      // @ts-expect-error nothing may follow enum
      rules(['required', 'enum:a,b', 'maxItems:1'])
      // @ts-expect-error nothing may follow enum
      rules(['required', 'enum:a,b', 'confirmed'])
      // @ts-expect-error nothing may follow enum
      rules(['required', 'enum:a,b', 'enum:c,d'])

      expect(true).toBe(true)
    })

    test('does not offer confirmed', () => {
      // @ts-expect-error confirmed is only available in passwordRules()
      rules(['required', 'string', 'minLength:8', 'confirmed'])

      expect(true).toBe(true)
    })

    test('cannot be used for an incomplete array rule set', () => {
      defineSchema({
        // @ts-expect-error array requires maxItems
        tags: rules(['required', 'array']),
      })

      expect(true).toBe(true)
    })
  })

  describe('passwordRules()', () => {
    test('accepts confirmed after minLength and/or maxLength', () => {
      const value = passwordRules([
        'required',
        'string',
        'minLength:8',
        'maxLength:40',
        'confirmed',
      ])

      passwordRules(['required', 'string', 'minLength:8', 'confirmed'])
      passwordRules(['required', 'string', 'maxLength:40', 'confirmed'])
      passwordRules(['required', 'string'])
      passwordRules(['required', 'string', 'minLength:8'])

      expect(value).toEqual(['required', 'string', 'minLength:8', 'maxLength:40', 'confirmed'])
    })

    test('rejects a misplaced or repeated confirmed', () => {
      // @ts-expect-error confirmed needs minLength or maxLength first
      passwordRules(['required', 'string', 'confirmed'])
      // @ts-expect-error confirmed must be the last rule
      passwordRules(['required', 'string', 'confirmed', 'minLength:8'])
      // @ts-expect-error confirmed cannot be repeated
      passwordRules(['required', 'string', 'minLength:8', 'confirmed', 'confirmed'])
      // @ts-expect-error confirmed only follows string limits
      passwordRules(['required', 'number', 'min:1', 'confirmed'])
      // @ts-expect-error nothing may follow enum
      passwordRules(['required', 'enum:a,b', 'confirmed'])

      expect(true).toBe(true)
    })

    test('keeps the same rules as rules() otherwise', () => {
      // @ts-expect-error min does not belong to string
      passwordRules(['required', 'string', 'min:5'])
      // @ts-expect-error minLength cannot be repeated
      passwordRules(['required', 'string', 'minLength:8', 'minLength:9'])

      expect(true).toBe(true)
    })

    test('is rejected with confirmed on a field that is not password', () => {
      defineSchema({
        password: passwordRules(['required', 'string', 'minLength:8', 'confirmed']),
        // @ts-expect-error confirmed is for password only
        username: passwordRules(['required', 'string', 'minLength:3', 'confirmed']),
      })

      expect(true).toBe(true)
    })
  })

  describe('defineSchema()', () => {
    test('returns the schema untouched', () => {
      const input = {
        username: rules(['required', 'string', 'minLength:3']),
        password: passwordRules(['required', 'string', 'minLength:8', 'confirmed']),
      }
      const schema = defineSchema(input)

      expect(schema).toBe(input)
    })

    test('produces a schema accepted by Validator.validate', () => {
      const schema = defineSchema({
        username: ['required', 'string', 'minLength:3', 'maxLength:20'],
        age: ['required', 'number', 'min:18', 'max:100'],
        tags: ['required', 'array', 'maxItems:5'],
        status: ['required', 'enum:active,pending'],
        password: ['required', 'string', 'minLength:8', 'maxLength:40', 'confirmed'],
      })

      const result = Validator.validate(
        {
          username: 'zen',
          age: 18,
          tags: ['a'],
          status: 'active',
          password: 'secret123',
          passwordConfirmation: 'secret123',
        },
        schema,
      )

      expect(result.valid).toBe(true)
    })

    test('keeps runtime validation working with helper-built rules', () => {
      const schema = defineSchema({
        password: passwordRules(['required', 'string', 'minLength:8', 'confirmed']),
      })

      const result = Validator.validate(
        { password: 'secret123', passwordConfirmation: 'nope' },
        schema,
      )

      expect(result.valid).toBe(false)
      expect(result.errors.password).toEqual(['password confirmation does not match'])
    })
  })

  describe('full schema, end to end', () => {
    const schema = defineSchema({
      username: ['required', 'string', 'minLength:3', 'maxLength:20'],
      nickname: ['nullable', 'string', 'maxLength:10'],
      age: ['required', 'number', 'min:18', 'max:100'],
      tags: ['required', 'array', 'minItems:1', 'maxItems:3'],
      isActive: ['required', 'boolean'],
      email: ['required', 'email'],
      website: ['nullable', 'url'],
      status: ['required', 'enum:active,pending,completed'],
      password: ['required', 'string', 'minLength:8', 'maxLength:40', 'confirmed'],
    })

    const validData = {
      username: 'zen',
      nickname: null,
      age: 20,
      tags: ['a', 'b'],
      isActive: true,
      email: 'zen@example.com',
      website: 'https://example.com',
      status: 'pending',
      password: 'secret123',
      passwordConfirmation: 'secret123',
    }

    test('accepts valid data for every type', () => {
      const result = Validator.validate(validData, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })

    test('reports an error for every invalid field', () => {
      const result = Validator.validate(
        {
          username: 'ab',
          nickname: 'a very long nickname',
          age: 10,
          tags: [],
          isActive: 'yes',
          email: 'nope',
          website: 'ftp://example.com',
          status: 'archived',
          password: 'secret123',
          passwordConfirmation: 'different',
        },
        schema,
      )

      expect(result.valid).toBe(false)
      expect(Object.keys(result.errors).sort()).toEqual([
        'age',
        'email',
        'isActive',
        'nickname',
        'password',
        'status',
        'tags',
        'username',
        'website',
      ])
    })

    test('rejects a value that is not one of the enum options', () => {
      const result = Validator.validate({ ...validData, status: 'archived' }, schema)

      expect(result.valid).toBe(false)
      expect(result.errors.status).toEqual(['status must be one of: active, pending, completed'])
    })

    test('rejects a missing enum value when it is required', () => {
      const { status: _status, ...withoutStatus } = validData
      const result = Validator.validate(withoutStatus, schema)

      expect(result.valid).toBe(false)
      expect(result.errors.status).toEqual(['status is required'])
    })

    test('accepts a missing nullable enum', () => {
      const optional = defineSchema({
        status: ['nullable', 'enum:active,pending'],
      })

      expect(Validator.validate({}, optional).valid).toBe(true)
      expect(Validator.validate({ status: null }, optional).valid).toBe(true)
      expect(Validator.validate({ status: 'active' }, optional).valid).toBe(true)
      expect(Validator.validate({ status: 'other' }, optional).valid).toBe(false)
    })

    test('requires the password confirmation to match', () => {
      const result = Validator.validate({ ...validData, passwordConfirmation: 'nope' }, schema)

      expect(result.valid).toBe(false)
      expect(result.errors.password).toEqual(['password confirmation does not match'])
    })
  })

  describe('exported types', () => {
    test('FieldRules never contains confirmed', () => {
      const valid: FieldRules = ['required', 'string', 'minLength:3']

      // @ts-expect-error FieldRules does not include confirmed
      const invalid: FieldRules = ['required', 'string', 'minLength:3', 'confirmed']

      expect(valid).toEqual(['required', 'string', 'minLength:3'])
      expect(invalid.length).toBe(4)
    })

    test('FieldRules accepts enum and nothing after it', () => {
      const valid: FieldRules = ['required', 'enum:a,b']

      // @ts-expect-error nothing may follow enum
      const invalid: FieldRules = ['required', 'enum:a,b', 'string']

      expect(valid).toEqual(['required', 'enum:a,b'])
      expect(invalid.length).toBe(3)
    })

    test('ValidationSchema is accepted by Validator.validate', () => {
      const schema: ValidationSchema = {
        email: ['required', 'email'],
      }

      const result = Validator.validate({ email: 'zen@example.com' }, schema)

      expect(result.valid).toBe(true)
    })
  })
})
