import { describe, expect, spyOn, test } from 'bun:test'
import { ErrorMessages } from '../../../src/errors/errors-messages'
import {
	Validator,
	type ValidationSchema
} from '../../../src/validation/validator'

// Expected shape of a successful validation result.
const ok = (data: Record<string, unknown>) => ({
	valid: true,
	data,
	errors: {}
})

// Used only for schemas that the type system intentionally rejects,
// so the runtime guards can still be tested.
const unsafeSchema = (schema: unknown): ValidationSchema =>
	schema as ValidationSchema

describe('Validator', () => {
	describe('valid data', () => {
		test('should validate an empty schema', () => {
			expect(Validator.validate({}, {})).toEqual(ok({}))
		})

		test('should validate required string fields', () => {
			const result = Validator.validate(
				{ name: 'Zen' },
				{ name: ['required', 'string'] }
			)

			expect(result).toEqual(ok({ name: 'Zen' }))
		})

		test('should return the same data object on success', () => {
			const data = { name: 'Zen' }
			const result = Validator.validate(data, {
				name: ['required', 'string']
			})

			expect(result.valid).toBe(true)

			if (result.valid) {
				expect(result.data).toBe(data)
			}
		})

		test('should validate multiple fields', () => {
			const result = Validator.validate(
				{
					name: 'Zen',
					age: 17,
					active: true,
					email: 'zen@example.com'
				},
				{
					name: ['required', 'string'],
					age: ['required', 'number', 'min:13'],
					active: ['boolean'],
					email: ['required', 'email']
				}
			)

			expect(result.valid).toBe(true)
			expect(result.errors).toEqual({})
		})

		test('should allow optional fields to be missing', () => {
			const result = Validator.validate(
				{},
				{
					name: ['string'],
					age: ['number'],
					email: ['email'],
					website: ['url'],
					status: ['enum:active,pending'],
					tags: ['array', 'minItems:1']
				}
			)

			expect(result).toEqual(ok({}))
		})

		test('should allow nullable fields to contain null', () => {
			const result = Validator.validate(
				{ nickname: null },
				{ nickname: ['nullable', 'string'] }
			)

			expect(result).toEqual(ok({ nickname: null }))
		})

		test('should allow nullable fields to be missing', () => {
			const result = Validator.validate(
				{},
				{ nickname: ['nullable', 'string'] }
			)

			expect(result).toEqual(ok({}))
		})

		test('should reject null for optional non-nullable fields', () => {
			const result = Validator.validate(
				{ name: null },
				{ name: ['string'] }
			)

			expect(result.valid).toBe(false)
			expect(result.errors.name).toEqual(['name must be a string'])
		})

		test('should skip optional empty strings', () => {
			const result = Validator.validate(
				{ email: '   ', age: '', website: ' ', status: '' },
				{
					email: ['email'],
					age: ['number'],
					website: ['url'],
					status: ['enum:active,pending']
				}
			)

			expect(result.valid).toBe(true)
			expect(result.errors).toEqual({})
		})

		test('should accept zero and false as valid values', () => {
			const result = Validator.validate(
				{ count: 0, enabled: false },
				{
					count: ['required', 'number', 'min:0'],
					enabled: ['required', 'boolean']
				}
			)

			expect(result).toEqual(ok({ count: 0, enabled: false }))
		})
	})

	describe('required rule', () => {
		test.each([
			['missing', {}],
			['undefined', { name: undefined }],
			['null', { name: null }],
			['empty string', { name: '' }],
			['whitespace-only string', { name: '   ' }]
		] as const)(
			'should reject a required field with %s',
			(_label, data) => {
				const result = Validator.validate(data, {
					name: ['required', 'string']
				})

				expect(result.valid).toBe(false)
				expect(result.errors.name).toEqual(['name is required'])
			}
		)

		test('should not run other rules once required fails', () => {
			const result = Validator.validate(
				{},
				{ age: ['required', 'number', 'min:18'] }
			)

			expect(result.errors.age).toEqual(['age is required'])
		})

		test('should validate required fields containing zero', () => {
			const result = Validator.validate(
				{ age: 0 },
				{ age: ['required', 'number'] }
			)

			expect(result).toEqual(ok({ age: 0 }))
		})

		test('should validate required fields containing false', () => {
			const result = Validator.validate(
				{ enabled: false },
				{ enabled: ['required', 'boolean'] }
			)

			expect(result).toEqual(ok({ enabled: false }))
		})

		test('should treat an empty array as present for required', () => {
			const result = Validator.validate(
				{ tags: [] },
				{ tags: ['required', 'array', 'maxItems:3'] }
			)

			expect(result).toEqual(ok({ tags: [] }))
		})
	})

	describe('type rules', () => {
		test('should reject non-string values', () => {
			const result = Validator.validate(
				{ name: 123 },
				{ name: ['string'] }
			)

			expect(result.errors.name).toEqual(['name must be a string'])
		})

		test.each<[string, unknown]>([
			['string', '123'],
			['null', null],
			['NaN', Number.NaN],
			['positive infinity', Number.POSITIVE_INFINITY],
			['negative infinity', Number.NEGATIVE_INFINITY]
		])('should reject %s as a number', (_label, value) => {
			const result = Validator.validate(
				{ age: value },
				{ age: ['number'] }
			)

			expect(result.valid).toBe(false)
			expect(result.errors.age).toContain('age must be a number')
		})

		test('should accept finite numbers', () => {
			const result = Validator.validate(
				{ age: 17.5 },
				{ age: ['number'] }
			)

			expect(result).toEqual(ok({ age: 17.5 }))
		})

		test('should reject non-boolean values', () => {
			const result = Validator.validate(
				{ active: 'true' },
				{ active: ['boolean'] }
			)

			expect(result.errors.active).toEqual(['active must be a boolean'])
		})

		test('should reject non-array values', () => {
			const result = Validator.validate(
				{ tags: 'a,b' },
				{ tags: ['array', 'minItems:1'] }
			)

			expect(result.errors.tags).toEqual(['tags must be an array'])
		})

		test('should stop further rules after a type failure', () => {
			const result = Validator.validate(
				{ age: 'not-a-number' },
				{ age: ['number', 'min:18'] }
			)

			expect(result.errors.age).toEqual(['age must be a number'])
		})
	})

	describe('email rule', () => {
		test.each([
			'zen@example.com',
			'user.name@example.co',
			'a+b@example.org'
		])('should accept a valid email: %s', (email) => {
			const result = Validator.validate({ email }, { email: ['email'] })

			expect(result).toEqual(ok({ email }))
		})

		test.each([
			'invalid',
			'zen@',
			'@example.com',
			'zen@example',
			'zen example@example.com'
		])('should reject an invalid email: %s', (email) => {
			const result = Validator.validate({ email }, { email: ['email'] })

			expect(result.valid).toBe(false)
			expect(result.errors.email).toContain('email must be a valid email')
		})

		test('should reject non-string values for email', () => {
			const result = Validator.validate(
				{ email: 123 },
				{ email: ['email'] }
			)

			expect(result.errors.email).toContain('email must be a valid email')
		})
	})

	describe('url rule', () => {
		test.each([
			'https://example.com',
			'http://example.com',
			'https://sub.example.com:8080/path?x=1#hash',
			'HTTP://EXAMPLE.COM'
		])('should accept a valid URL: %s', (website) => {
			const result = Validator.validate(
				{ website },
				{ website: ['url'] }
			)

			expect(result).toEqual(ok({ website }))
		})

		test.each([
			'not a url',
			'example.com',
			'http:example.com',
			'http:///x',
			' https://example.com',
			'https://example.com ',
			'https://exa mple.com'
		])('should reject a malformed URL: %s', (website) => {
			const result = Validator.validate(
				{ website },
				{ website: ['url'] }
			)

			expect(result.valid).toBe(false)
			expect(result.errors.website).toEqual([
				'website must be a valid URL'
			])
		})

		test.each([
			'ftp://example.com',
			'mailto:zen@example.com',
			'javascript:alert(1)'
		])('should reject a non-http(s) protocol: %s', (website) => {
			const result = Validator.validate(
				{ website },
				{ website: ['url'] }
			)

			expect(result.valid).toBe(false)
			expect(result.errors.website).toEqual([
				'website URL must use http or https'
			])
		})

		test('should reject non-string values for url', () => {
			const result = Validator.validate(
				{ website: 123 },
				{ website: ['url'] }
			)

			expect(result.errors.website).toEqual(['website must be a string'])
		})
	})

	describe('enum rule', () => {
		test.each(['active', 'pending'])(
			'should accept an allowed value: %s',
			(status) => {
				const result = Validator.validate(
					{ status },
					{ status: ['required', 'enum:active,pending'] }
				)

				expect(result).toEqual(ok({ status }))
			}
		)

		test('should reject a value that is not allowed', () => {
			const result = Validator.validate(
				{ status: 'archived' },
				{ status: ['enum:active,pending'] }
			)

			expect(result.errors.status).toEqual([
				'status must be one of: active, pending'
			])
		})

		test('should compare case-sensitively', () => {
			const result = Validator.validate(
				{ status: 'Active' },
				{ status: ['enum:active,pending'] }
			)

			expect(result.valid).toBe(false)
			expect(result.errors.status).toEqual([
				'status must be one of: active, pending'
			])
		})

		test('should not coerce non-string values', () => {
			const result = Validator.validate(
				{ level: 1 },
				{ level: ['enum:1,2,3'] }
			)

			expect(result.valid).toBe(false)
			expect(result.errors.level).toEqual([
				'level must be one of: 1, 2, 3'
			])
		})

		test('should trim whitespace around options', () => {
			const result = Validator.validate(
				{ status: 'pending' },
				{ status: ['enum:active, pending'] }
			)

			expect(result).toEqual(ok({ status: 'pending' }))
		})
	})

	describe('confirmed rule', () => {
		test('should pass when the confirmation matches', () => {
			const data = {
				password: 'secret123',
				passwordConfirmation: 'secret123'
			}

			const result = Validator.validate(data, {
				password: ['required', 'string', 'confirmed']
			})

			expect(result).toEqual(ok(data))
		})

		test('should fail when the confirmation does not match', () => {
			const result = Validator.validate(
				{
					password: 'secret123',
					passwordConfirmation: 'different'
				},
				{ password: ['required', 'string', 'confirmed'] }
			)

			expect(result.errors.password).toEqual([
				'password confirmation does not match'
			])
		})

		test('should fail when the confirmation is missing', () => {
			const result = Validator.validate(
				{ password: 'secret123' },
				{ password: ['required', 'string', 'confirmed'] }
			)

			expect(result.errors.password).toContain(
				'password confirmation does not match'
			)
		})

		test('should work with numbers', () => {
			const result = Validator.validate(
				{ pin: 1234, pinConfirmation: 1234 },
				{ pin: ['number', 'confirmed'] }
			)

			expect(result.valid).toBe(true)
		})

		test('should be skipped when an optional field is missing', () => {
			const result = Validator.validate(
				{},
				{ password: ['string', 'confirmed'] }
			)

			expect(result).toEqual(ok({}))
		})
	})

	describe('min and max rules (numbers)', () => {
		test('should accept a number within the limits', () => {
			const result = Validator.validate(
				{ age: 18 },
				{ age: ['number', 'min:18', 'max:65'] }
			)

			expect(result).toEqual(ok({ age: 18 }))
		})

		test('should accept limits in any order', () => {
			const result = Validator.validate(
				{ age: 30 },
				{ age: ['number', 'max:65', 'min:18'] }
			)

			expect(result).toEqual(ok({ age: 30 }))
		})

		test('should reject a number below the minimum', () => {
			const result = Validator.validate(
				{ age: 17 },
				{ age: ['number', 'min:18'] }
			)

			expect(result.errors.age).toEqual(['age must be at least 18'])
		})

		test('should reject a number above the maximum', () => {
			const result = Validator.validate(
				{ age: 66 },
				{ age: ['number', 'max:65'] }
			)

			expect(result.errors.age).toEqual([
				'age may not be greater than 65'
			])
		})

		test('should support decimal limits for numbers', () => {
			const result = Validator.validate(
				{ price: 9.5 },
				{ price: ['number', 'min:9.5', 'max:10.5'] }
			)

			expect(result).toEqual(ok({ price: 9.5 }))
		})
	})

	describe('minLength and maxLength rules', () => {
		test('should accept strings within the length limits', () => {
			const result = Validator.validate(
				{ username: 'Zen' },
				{ username: ['string', 'minLength:3', 'maxLength:10'] }
			)

			expect(result).toEqual(ok({ username: 'Zen' }))
		})

		test('should accept limits in any order', () => {
			const result = Validator.validate(
				{ username: 'Zen' },
				{ username: ['string', 'maxLength:10', 'minLength:3'] }
			)

			expect(result).toEqual(ok({ username: 'Zen' }))
		})

		test('should reject strings shorter than minLength', () => {
			const result = Validator.validate(
				{ username: 'ab' },
				{ username: ['string', 'minLength:3'] }
			)

			expect(result.errors.username).toEqual([
				'username must be at least 3 characters'
			])
		})

		test('should reject strings longer than maxLength', () => {
			const result = Validator.validate(
				{ username: 'abcdefghijkl' },
				{ username: ['string', 'maxLength:10'] }
			)

			expect(result.errors.username).toEqual([
				'username may not exceed 10 characters'
			])
		})

		test('should only report the type error for non-string values', () => {
			const result = Validator.validate(
				{ username: 123 },
				{ username: ['string', 'minLength:3'] }
			)

			expect(result.errors.username).toEqual([
				'username must be a string'
			])
		})
	})

	describe('minItems and maxItems rules', () => {
		test('should accept arrays within the limits', () => {
			const result = Validator.validate(
				{ tags: ['a', 'b'] },
				{ tags: ['array', 'minItems:1', 'maxItems:3'] }
			)

			expect(result).toEqual(ok({ tags: ['a', 'b'] }))
		})

		test('should accept limits in any order', () => {
			const result = Validator.validate(
				{ tags: ['a', 'b'] },
				{ tags: ['array', 'maxItems:3', 'minItems:1'] }
			)

			expect(result).toEqual(ok({ tags: ['a', 'b'] }))
		})

		test('should reject arrays with too few items', () => {
			const result = Validator.validate(
				{ tags: ['a'] },
				{ tags: ['array', 'minItems:2'] }
			)

			expect(result.errors.tags).toEqual([
				'tags must contain at least 2 items'
			])
		})

		test('should reject arrays with too many items', () => {
			const result = Validator.validate(
				{ tags: ['a', 'b', 'c'] },
				{ tags: ['array', 'maxItems:2'] }
			)

			expect(result.errors.tags).toEqual([
				'tags may not contain more than 2 items'
			])
		})

		test('should reject an empty required array when minItems is set', () => {
			const result = Validator.validate(
				{ tags: [] },
				{ tags: ['required', 'array', 'minItems:1'] }
			)

			expect(result.errors.tags).toEqual([
				'tags must contain at least 1 items'
			])
		})
	})

	describe('multiple validation errors', () => {
		test('should collect multiple errors for one field', () => {
			const result = Validator.validate(
				{ password: 'abc', passwordConfirmation: 'xyz' },
				{ password: ['string', 'minLength:5', 'confirmed'] }
			)

			expect(result.valid).toBe(false)
			// "confirmed" is checked before the limit rules.
			expect(result.errors.password).toEqual([
				'password confirmation does not match',
				'password must be at least 5 characters'
			])
		})

		test('should collect errors across multiple fields', () => {
			const result = Validator.validate(
				{ name: '', age: 'old' },
				{
					name: ['required', 'string'],
					age: ['number']
				}
			)

			expect(result.valid).toBe(false)
			expect(result.errors).toEqual({
				name: ['name is required'],
				age: ['age must be a number']
			})
		})

		test('should not include data on failure', () => {
			const result = Validator.validate(
				{ name: '' },
				{ name: ['required', 'string'] }
			)

			expect(result.valid).toBe(false)
			expect('data' in result).toBe(false)
		})
	})

	describe('invalid validation data', () => {
		test.each([
			['null', null],
			['an array', []],
			['a string', 'hello'],
			['a number', 123],
			['a boolean', true]
		])('should throw when data is %s', (_label, data) => {
			expect(() =>
				Validator.validate(
					data as unknown as Record<string, unknown>,
					{}
				)
			).toThrow('Validation data must be a plain object')
		})
	})

	describe('invalid validation schemas', () => {
		test('should throw when a field rules value is not an array', () => {
			const schema = unsafeSchema({ name: 'required' })

			expect(() => Validator.validate({}, schema)).toThrow(
				'Invalid validation rules for "name"'
			)
		})

		test('should throw when a rule is not a string', () => {
			const schema = unsafeSchema({ name: [123] })

			expect(() => Validator.validate({}, schema)).toThrow(
				'Invalid validation rule for "name"'
			)
		})

		test('should throw for unknown rules', () => {
			const schema = unsafeSchema({ name: ['unknown'] })

			expect(() => Validator.validate({}, schema)).toThrow(
				'Unknown validation rule: unknown'
			)
		})

		test.each(['required:1', 'nullable:1', 'string:1', 'url:x'])(
			'should throw when a rule that does not accept a limit has one: %s',
			(rule) => {
				const name = rule.split(':')[0]

				expect(() =>
					Validator.validate({}, unsafeSchema({ field: [rule] }))
				).toThrow(`Rule "${name}" does not accept a limit`)
			}
		)

		test.each([
			'min',
			'max',
			'minLength',
			'maxLength',
			'minItems',
			'maxItems'
		])('should throw when %s has no limit', (rule) => {
			expect(() =>
				Validator.validate({}, unsafeSchema({ name: [rule] }))
			).toThrow(`Rule "${rule}" requires a limit`)
		})

		test.each(['min:-1', 'max:abc', 'min:1.2.3', 'min:', 'maxItems:-2'])(
			'should throw for an invalid limit: %s',
			(rule) => {
				expect(() =>
					Validator.validate({}, unsafeSchema({ name: [rule] }))
				).toThrow(`Invalid validation limit: ${rule}`)
			}
		)

		test.each([
			['minLength', 'minLength:1.5'],
			['maxLength', 'maxLength:2.5'],
			['minItems', 'minItems:1.5'],
			['maxItems', 'maxItems:2.5']
		])('should require an integer limit for %s', (name, rule) => {
			expect(() =>
				Validator.validate({}, unsafeSchema({ field: [rule] }))
			).toThrow(`Rule "${name}" requires an integer limit`)
		})

		test('should throw when enum has no options', () => {
			expect(() =>
				Validator.validate({}, unsafeSchema({ status: ['enum'] }))
			).toThrow(
				'Rule "enum" requires options for "status" (e.g. "enum:active,pending")'
			)
		})

		test.each(['enum:', 'enum:a,,b', 'enum:a, ,b'])(
			'should throw for an empty enum option: %s',
			(rule) => {
				expect(() =>
					Validator.validate({}, unsafeSchema({ status: [rule] }))
				).toThrow(
					`Invalid enum rule for "status": empty option in "${rule}"`
				)
			}
		)

		test.each(['enum:a,b,a', 'enum:a, a'])(
			'should throw for a duplicate enum option: %s',
			(rule) => {
				expect(() =>
					Validator.validate({}, unsafeSchema({ status: [rule] }))
				).toThrow(
					`Invalid enum rule for "status": duplicate option in "${rule}"`
				)
			}
		)

		test('should reject required and nullable together', () => {
			const errorSpy = spyOn(console, 'error').mockImplementation(
				() => {}
			)

			try {
				expect(() =>
					Validator.validate(
						{},
						unsafeSchema({ name: ['required', 'nullable'] })
					)
				).toThrow('[RiserBob] Invalid rules for field "name".')

				expect(errorSpy).toHaveBeenCalledTimes(1)
			} finally {
				errorSpy.mockRestore()
			}
		})

		test('should validate the schema even when the data is empty', () => {
			expect(() =>
				Validator.validate({}, unsafeSchema({ name: ['unknown'] }))
			).toThrow('Unknown validation rule: unknown')
		})
	})

	describe('runtime behaviour outside the type contract', () => {
		// These combinations are rejected by `ValidationSchema` at compile time,
		// but the runtime keeps working defensively for untyped callers.
		test('should apply min and max to string length', () => {
			const result = Validator.validate(
				{ username: 'ab' },
				unsafeSchema({ username: ['string', 'min:3', 'max:10'] })
			)

			expect(result.errors.username).toEqual([
				'username must be at least 3 characters'
			])
		})

		test('should reject strings exceeding max', () => {
			const result = Validator.validate(
				{ username: 'abcdefghijkl' },
				unsafeSchema({ username: ['string', 'max:10'] })
			)

			expect(result.errors.username).toEqual([
				'username may not exceed 10 characters'
			])
		})

		test('should report a type error when min is used on an unsupported type', () => {
			const result = Validator.validate(
				{ active: true },
				unsafeSchema({ active: ['min:1'] })
			)

			expect(result.errors.active).toContain(
				'active must be a string or number for min'
			)
		})

		test('should reject non-string values for minLength without string', () => {
			const result = Validator.validate(
				{ username: 123 },
				unsafeSchema({ username: ['minLength:3'] })
			)

			expect(result.errors.username).toContain(
				'username must be a string'
			)
		})

		test('should reject non-array values for minItems without array', () => {
			const result = Validator.validate(
				{ tags: 'abc' },
				unsafeSchema({ tags: ['minItems:1'] })
			)

			expect(result.errors.tags).toContain('tags must be an array')
		})
	})

	describe('configure', () => {
		test('should use the configured error messages', () => {
			const messages = new ErrorMessages()
			const messageSpy = spyOn(
				messages,
				'invalidValidationSchema'
			).mockImplementation(() => 'custom invalid schema message')
			const errorSpy = spyOn(console, 'error').mockImplementation(
				() => {}
			)

			Validator.configure(messages)

			try {
				expect(() =>
					Validator.validate(
						{},
						unsafeSchema({ name: ['required', 'nullable'] })
					)
				).toThrow()

				expect(messageSpy).toHaveBeenCalledWith('name')
				expect(errorSpy).toHaveBeenCalledWith(
					'custom invalid schema message'
				)
			} finally {
				// Restore the default messages for the other tests.
				Validator.configure(new ErrorMessages())
				errorSpy.mockRestore()
				messageSpy.mockRestore()
			}
		})
	})
})