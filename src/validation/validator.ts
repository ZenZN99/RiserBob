export type ValidationRule =
	| 'required'
	| 'nullable'
	| 'string'
	| 'number'
	| 'boolean'
	| 'email'
	| 'confirmed'
	| `min:${number}`
	| `max:${number}`
	| `minLength:${number}`
	| `maxLength:${number}`

export type ValidationSchema = Record<string, ValidationRule[]>

export type ValidationErrors = Record<string, string[]>

export type ValidationResult<T> =
	| {
			valid: true
			data: T
			errors: ValidationErrors
	  }
	| {
			valid: false
			errors: ValidationErrors
	  }

type ParsedRule = {
	name: string
	limit?: number
}

const RULE_NAMES = new Set([
	'required',
	'nullable',
	'string',
	'number',
	'boolean',
	'email',
	'confirmed',
	'min',
	'max',
	'minLength',
	'maxLength'
])

export class Validator {
	private static parseSchema(
		schema: ValidationSchema
	): Record<string, ParsedRule[]> {
		const parsed: Record<string, ParsedRule[]> = {}

		for (const [field, rules] of Object.entries(schema)) {
			if (!Array.isArray(rules)) {
				throw new TypeError(`Invalid validation rules for "${field}"`)
			}

			parsed[field] = rules.map((rule) => {
				if (typeof rule !== 'string') {
					throw new TypeError(
						`Invalid validation rule for "${field}"`
					)
				}

				const separator = rule.indexOf(':')
				const name = separator === -1 ? rule : rule.slice(0, separator)

				if (!RULE_NAMES.has(name)) {
					throw new TypeError(`Unknown validation rule: ${rule}`)
				}

				const needsLimit = [
					'min',
					'max',
					'minLength',
					'maxLength'
				].includes(name)

				if (!needsLimit) {
					if (separator !== -1) {
						throw new TypeError(
							`Rule "${name}" does not accept a limit`
						)
					}

					return { name }
				}

				if (separator === -1) {
					throw new TypeError(`Rule "${name}" requires a limit`)
				}

				const rawLimit = rule.slice(separator + 1)

				if (!/^\d+(?:\.\d+)?$/.test(rawLimit)) {
					throw new TypeError(`Invalid validation limit: ${rule}`)
				}

				const limit = Number(rawLimit)

				if (!Number.isFinite(limit)) {
					throw new TypeError(`Invalid validation limit: ${rule}`)
				}

				if (name.endsWith('Length') && !Number.isInteger(limit)) {
					throw new TypeError(
						`Rule "${name}" requires an integer limit`
					)
				}

				return { name, limit }
			})

			const names = parsed[field].map((rule) => rule.name)
			if (names.includes('required') && names.includes('nullable')) {
				console.error(
					`[RiserBob] 🧽🍍 Oh, barnacles! Invalid Validation Schema!
  Field: ${field}
  💥 "required" and "nullable" cannot be combined!
  🦑 Squidward says: "Fix your Schema already!"`
				)

				throw new TypeError(
					`[RiserBob] Invalid rules for field "${field}".`
				)
			}
		}

		return parsed
	}

	static validate<T>(
		data: Record<string, unknown>,
		schema: ValidationSchema
	): ValidationResult<T> {
		if (data === null || typeof data !== 'object' || Array.isArray(data)) {
			throw new TypeError('Validation data must be a plain object')
		}

		const parsedSchema = this.parseSchema(schema)
		const errors: ValidationErrors = {}

		const addError = (field: string, message: string): void => {
			;(errors[field] ??= []).push(message)
		}

		for (const [field, rules] of Object.entries(parsedSchema)) {
			const value = data[field]
			const names = rules.map((rule) => rule.name)
			const required = names.includes('required')
			const nullable = names.includes('nullable')

			const missing =
				value === undefined ||
				value === null ||
				(typeof value === 'string' && value.trim() === '')

			if (required && missing) {
				addError(field, `${field} is required`)
				continue
			}

			if (value === undefined) continue

			if (value === null && nullable) continue

			if (typeof value === 'string' && value.trim() === '' && !required) {
				continue
			}

			let typeFailed = false

			if (names.includes('string') && typeof value !== 'string') {
				addError(field, `${field} must be a string`)
				typeFailed = true
			}

			if (
				names.includes('number') &&
				(typeof value !== 'number' || !Number.isFinite(value))
			) {
				addError(field, `${field} must be a number`)
				typeFailed = true
			}

			if (names.includes('boolean') && typeof value !== 'boolean') {
				addError(field, `${field} must be a boolean`)
				typeFailed = true
			}

			if (typeFailed) continue

			if (
				names.includes('email') &&
				(typeof value !== 'string' ||
					!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
			) {
				addError(field, `${field} must be a valid email`)
			}

			if (
				names.includes('confirmed') &&
				value !== data[`${field}Confirmation`]
			) {
				addError(field, `${field} confirmation does not match`)
			}

			for (const rule of rules) {
				const { name, limit } = rule

				if (limit === undefined) continue

				if (name === 'min' || name === 'max') {
					if (typeof value === 'number') {
						if (name === 'min' && value < limit) {
							addError(
								field,
								`${field} must be at least ${limit}`
							)
						}

						if (name === 'max' && value > limit) {
							addError(
								field,
								`${field} may not be greater than ${limit}`
							)
						}
					} else if (typeof value === 'string') {
						if (name === 'min' && value.length < limit) {
							addError(
								field,
								`${field} must be at least ${limit} characters`
							)
						}

						if (name === 'max' && value.length > limit) {
							addError(
								field,
								`${field} may not exceed ${limit} characters`
							)
						}
					} else {
						addError(
							field,
							`${field} must be a string or number for ${name}`
						)
					}
				}

				if (name === 'minLength') {
					if (typeof value !== 'string') {
						addError(field, `${field} must be a string`)
					} else if (value.length < limit) {
						addError(
							field,
							`${field} must be at least ${limit} characters`
						)
					}
				}

				if (name === 'maxLength') {
					if (typeof value !== 'string') {
						addError(field, `${field} must be a string`)
					} else if (value.length > limit) {
						addError(
							field,
							`${field} may not exceed ${limit} characters`
						)
					}
				}
			}
		}

		if (Object.keys(errors).length > 0) {
			return {
				valid: false,
				errors
			}
		}

		return {
			valid: true,
			data: data as T,
			errors: {}
		}
	}
}
