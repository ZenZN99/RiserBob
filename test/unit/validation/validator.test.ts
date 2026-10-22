import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
	Validator,
	type ValidationSchema,
	type ValidationRule
} from '../../../src/validation/validator'

// Expected shape of a successful validation result.
const ok = (data: Record<string, unknown>) => ({
	valid: true,
	data,
	errors: {}
})

describe('Validator', () => {
	afterEach(() => {
		// Restore spies after each test.
		// This is useful for tests that check invalid schemas.
	})

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
					email: ['email']
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

		test('should skip optional empty strings', () => {
			const result = Validator.validate(
				{ email: '   ' },
				{ email: ['email'] }
			)

			expect(result).toEqual(ok({ email: '   ' }))
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
					name: ['required']
				})

				expect(result.valid).toBe(false)
				expect(result.errors.name).toEqual(['name is required'])
			}
		)

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
	})

	describe('type rules', () => {
		test('should reject non-string values', () => {
			const result = Validator.validate(
				{ name: 123 },
				{ name: ['string'] }
			)

			expect(result.errors.name).toEqual(['name must be a string'])
		})

		test.each([
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

	describe('confirmed rule', () => {
		test('should pass when the confirmation matches', () => {
			const data = {
				password: 'secret123',
				passwordConfirmation: 'secret123'
			}

			const result = Validator.validate(data, {
				password: ['required', 'confirmed']
			})

			expect(result).toEqual(ok(data))
		})

		test('should fail when the confirmation does not match', () => {
			const result = Validator.validate(
				{
					password: 'secret123',
					passwordConfirmation: 'different'
				},
				{ password: ['required', 'confirmed'] }
			)

			expect(result.errors.password).toEqual([
				'password confirmation does not match'
			])
		})

		test('should fail when the confirmation is missing', () => {
			const result = Validator.validate(
				{ password: 'secret123' },
				{ password: ['required', 'confirmed'] }
			)

			expect(result.errors.password).toContain(
				'password confirmation does not match'
			)
		})
	})

	describe('min and max rules', () => {
		test('should accept a number within the limits', () => {
			const result = Validator.validate(
				{ age: 18 },
				{ age: ['number', 'min:18', 'max:65'] }
			)

			expect(result).toEqual(ok({ age: 18 }))
		})

		test('should reject a number below the minimum', () => {
			const result = Validator.validate(
				{ age: 17 },
				{ age: ['number', 'min:18'] }
			)

			expect(result.errors.age).toContain('age must be at least 18')
		})

		test('should reject a number above the maximum', () => {
			const result = Validator.validate(
				{ age: 66 },
				{ age: ['number', 'max:65'] }
			)

			expect(result.errors.age).toContain(
				'age may not be greater than 65'
			)
		})

		test('should support decimal limits for numbers', () => {
			const result = Validator.validate(
				{ price: 9.5 },
				{ price: ['number', 'min:9.5', 'max:10.5'] }
			)

			expect(result).toEqual(ok({ price: 9.5 }))
		})

		test('should apply min and max to string length', () => {
			const result = Validator.validate(
				{ username: 'ab' },
				{ username: ['string', 'min:3', 'max:10'] }
			)

			expect(result.errors.username).toContain(
				'username must be at least 3 characters'
			)
		})

		test('should reject strings exceeding max', () => {
			const result = Validator.validate(
				{ username: 'abcdefghijkl' },
				{ username: ['string', 'max:10'] }
			)

			expect(result.errors.username).toContain(
				'username may not exceed 10 characters'
			)
		})

		test('should report a type error when min is used on an unsupported type', () => {
			const result = Validator.validate(
				{ active: true },
				{ active: ['min:1'] }
			)

			expect(result.errors.active).toContain(
				'active must be a string or number for min'
			)
		})
	})

	describe('minLength and maxLength rules', () => {
		test('should accept strings within the length limits', () => {
			const result = Validator.validate(
				{ username: 'Zen' },
				{ username: ['minLength:3', 'maxLength:10'] }
			)

			expect(result).toEqual(ok({ username: 'Zen' }))
		})

		test('should reject strings shorter than minLength', () => {
			const result = Validator.validate(
				{ username: 'ab' },
				{ username: ['minLength:3'] }
			)

			expect(result.errors.username).toContain(
				'username must be at least 3 characters'
			)
		})

		test('should reject strings longer than maxLength', () => {
			const result = Validator.validate(
				{ username: 'abcdefghijkl' },
				{ username: ['maxLength:10'] }
			)

			expect(result.errors.username).toContain(
				'username may not exceed 10 characters'
			)
		})

		test('should reject non-string values for minLength', () => {
			const result = Validator.validate(
				{ username: 123 },
				{ username: ['minLength:3'] }
			)

			expect(result.errors.username).toContain(
				'username must be a string'
			)
		})

		test('should reject non-string values for maxLength', () => {
			const result = Validator.validate(
				{ username: true },
				{ username: ['maxLength:10'] }
			)

			expect(result.errors.username).toContain(
				'username must be a string'
			)
		})
	})

	describe('multiple validation errors', () => {
		test('should collect multiple errors for one field', () => {
			const result = Validator.validate(
				{ email: 'invalid' },
				{ email: ['email', 'confirmed'] }
			)

			expect(result.valid).toBe(false)
			expect(result.errors.email).toEqual([
				'email must be a valid email',
				'email confirmation does not match'
			])
		})

		test('should collect errors across multiple fields', () => {
			const result = Validator.validate(
				{ name: '', age: 'old' },
				{
					name: ['required'],
					age: ['number']
				}
			)

			expect(result.valid).toBe(false)
			expect(result.errors).toEqual({
				name: ['name is required'],
				age: ['age must be a number']
			})
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
			const schema = {
				name: 'required'
			} as unknown as ValidationSchema

			expect(() => Validator.validate({}, schema)).toThrow(
				'Invalid validation rules for "name"'
			)
		})

		test('should throw when a rule is not a string', () => {
			const schema = {
				name: [123]
			} as unknown as ValidationSchema

			expect(() => Validator.validate({}, schema)).toThrow(
				'Invalid validation rule for "name"'
			)
		})

		test('should throw for unknown rules', () => {
			const schema = {
				name: ['unknown']
			} as unknown as ValidationSchema

			expect(() => Validator.validate({}, schema)).toThrow(
				'Unknown validation rule: unknown'
			)
		})

		test('should throw when a rule that does not accept a limit has one', () => {
			expect(() =>
				Validator.validate(
					{},
					{ name: ['required:1' as ValidationRule] }
				)
			).toThrow('Rule "required" does not accept a limit')
		})

		test.each(['min', 'max', 'minLength', 'maxLength'])(
			'should throw when %s has no limit',
			(rule) => {
				expect(() =>
					Validator.validate({}, { name: [rule as ValidationRule] })
				).toThrow(`Rule "${rule}" requires a limit`)
			}
		)

		test.each([
			'min:-1',
			'max:abc',
			'min:1.2.3',
			'maxLength:2.5',
			'minLength:1.5'
		])('should throw for an invalid limit: %s', (rule) => {
			expect(() =>
				Validator.validate({}, { name: [rule as ValidationRule] })
			).toThrow()
		})

		test('should reject required and nullable together', () => {
			const errorSpy = spyOn(console, 'error').mockImplementation(
				() => {}
			)

			try {
				expect(() =>
					Validator.validate({}, { name: ['required', 'nullable'] })
				).toThrow('[RiserBob] Invalid rules for field "name".')

				expect(errorSpy).toHaveBeenCalledTimes(1)
			} finally {
				errorSpy.mockRestore()
			}
		})
	})
})
