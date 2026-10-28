import { ErrorMessages } from '../errors/errors-messages'

export type ValidationRule =
	| 'required'
	| 'nullable'
	| 'string'
	| 'number'
	| 'boolean'
	| 'email'
	| 'confirmed'
	| 'array'
	| 'url'
	| `enum:${string}`
	| `min:${number}`
	| `max:${number}`
	| `minLength:${number}`
	| `maxLength:${number}`
	| `minItems:${number}`
	| `maxItems:${number}`

type BaseRule = 'required' | 'nullable'

type MinItemsRule = `minItems:${number}`
type MaxItemsRule = `maxItems:${number}`
type MinLengthRule = `minLength:${number}`
type MaxLengthRule = `maxLength:${number}`
type MinRule = `min:${number}`
type MaxRule = `max:${number}`

// Optionally appends "confirmed" as the very last rule.
type WithConfirmed<T extends readonly unknown[]> =
	| T
	| readonly [...T, 'confirmed']

// Each limit rule may appear at most once, in any order.
type StringRules = WithConfirmed<
	| readonly ['string']
	| readonly ['string', MinLengthRule]
	| readonly ['string', MaxLengthRule]
	| readonly ['string', MinLengthRule, MaxLengthRule]
	| readonly ['string', MaxLengthRule, MinLengthRule]
>

type NumberRules = WithConfirmed<
	| readonly ['number']
	| readonly ['number', MinRule]
	| readonly ['number', MaxRule]
	| readonly ['number', MinRule, MaxRule]
	| readonly ['number', MaxRule, MinRule]
>

// "email" is a specialised string type: nothing may follow it.
type EmailRules = readonly ['email']

// "url" and "enum:a,b" are final types as well: nothing may follow them.
type UrlRules = readonly ['url']
type EnumRules = readonly [`enum:${string}`]

// "boolean" has no sub-rules: it is always the last element.
type BooleanRules = readonly ['boolean']

// array requires at least one of minItems / maxItems (each at most once).
type ArrayRules =
	| readonly ['array', MinItemsRule]
	| readonly ['array', MaxItemsRule]
	| readonly ['array', MinItemsRule, MaxItemsRule]
	| readonly ['array', MaxItemsRule, MinItemsRule]

type TypedRules =
	| StringRules
	| NumberRules
	| EmailRules
	| UrlRules
	| EnumRules
	| BooleanRules
	| ArrayRules

export type FieldRules = TypedRules | readonly [BaseRule, ...TypedRules]

export type ValidationSchema = Record<string, FieldRules>

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
	options?: string[]
}

// Strict http(s) URL check: `new URL()` alone is too lenient
// (it accepts "mailto:", "javascript:", "http:example.com", "http:///x", ...).
type UrlCheck = 'ok' | 'invalid' | 'protocol'

function checkUrl(value: string): UrlCheck {
	if (value !== value.trim() || /\s/.test(value)) return 'invalid'

	let url: URL
	try {
		url = new URL(value)
	} catch {
		return 'invalid'
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return 'protocol'
	}

	// require an explicit "//" followed by a real host
	if (!/^https?:\/\/[^/\\?#@]/i.test(value) || url.hostname === '') {
		return 'invalid'
	}

	return 'ok'
}

const RULE_NAMES = new Set([
	'url',
	'enum',
	'required',
	'nullable',
	'string',
	'number',
	'boolean',
	'email',
	'confirmed',
	'array',
	'min',
	'max',
	'minLength',
	'maxLength',
	'minItems',
	'maxItems'
])

export class Validator {
	private static errorMessages = new ErrorMessages()

	static configure(errorMessages: ErrorMessages): void {
		this.errorMessages = errorMessages
	}

	private static parseSchema(
		schema: ValidationSchema
	): Record<string, ParsedRule[]> {
		const parsed: Record<string, ParsedRule[]> = {}

		for (const [field, rules] of Object.entries(schema)) {
			if (!Array.isArray(rules)) {
				throw new TypeError(`Invalid validation rules for "${field}"`)
			}

			parsed[field] = (rules as readonly ValidationRule[]).map((rule) => {
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

				if (name === 'enum') {
					if (separator === -1) {
						throw new TypeError(
							`Rule "enum" requires options for "${field}" (e.g. "enum:active,pending")`
						)
					}

					// Options are split on "," only and trimmed consistently.
					const options = rule
						.slice(separator + 1)
						.split(',')
						.map((option) => option.trim())

					if (options.some((option) => option === '')) {
						throw new TypeError(
							`Invalid enum rule for "${field}": empty option in "${rule}"`
						)
					}

					if (new Set(options).size !== options.length) {
						throw new TypeError(
							`Invalid enum rule for "${field}": duplicate option in "${rule}"`
						)
					}

					return { name, options }
				}

				const needsLimit = [
					'min',
					'max',
					'minLength',
					'maxLength',
					'minItems',
					'maxItems'
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

				if (
					(name.endsWith('Length') ||
						name === 'minItems' ||
						name === 'maxItems') &&
					!Number.isInteger(limit)
				) {
					throw new TypeError(
						`Rule "${name}" requires an integer limit`
					)
				}

				return { name, limit }
			})

			const names = parsed[field].map((rule) => rule.name)
			if (names.includes('required') && names.includes('nullable')) {
				console.error(this.errorMessages.invalidValidationSchema(field))

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

			if (names.includes('array') && !Array.isArray(value)) {
				addError(field, `${field} must be an array`)
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

			if (names.includes('url')) {
				if (typeof value !== 'string') {
					addError(field, `${field} must be a string`)
				} else {
					const check = checkUrl(value)

					if (check === 'invalid') {
						addError(field, `${field} must be a valid URL`)
					} else if (check === 'protocol') {
						addError(field, `${field} URL must use http or https`)
					}
				}
			}

			const enumRule = rules.find((rule) => rule.name === 'enum')

			if (enumRule?.options !== undefined) {
				// strict, case-sensitive comparison; no coercion to string
				if (
					typeof value !== 'string' ||
					!enumRule.options.includes(value)
				) {
					addError(
						field,
						`${field} must be one of: ${enumRule.options.join(', ')}`
					)
				}
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

				if (name === 'minItems' || name === 'maxItems') {
					if (limit === undefined) continue

					if (!Array.isArray(value)) {
						addError(field, `${field} must be an array`)
						continue
					}

					if (name === 'minItems' && value.length < limit) {
						addError(
							field,
							`${field} must contain at least ${limit} items`
						)
					}

					if (name === 'maxItems' && value.length > limit) {
						addError(
							field,
							`${field} may not contain more than ${limit} items`
						)
					}

					continue
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
