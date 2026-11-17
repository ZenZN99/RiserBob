import type {
  ConvertedField,
  ConvertedSchema,
  JsonObjectSchema,
  JsonSchema,
  JsonSchemaTypeName,
} from '../types/schema.types.js'
import { isRecord } from '../utils/guards.js'

/** Thrown when a RiserBob schema cannot be represented faithfully as JSON Schema. */
export class SchemaConversionError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(problems.join('; '))
    this.name = 'SchemaConversionError'
    this.problems = problems
  }
}

// Mirrors the rule vocabulary of RiserBob's `Validator` (src/validation/validator.ts).
// The converter does not execute validation; it only describes what the Validator enforces.
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
  'maxItems',
])
const LIMIT_RULES = new Set(['min', 'max', 'minLength', 'maxLength', 'minItems', 'maxItems'])
const INTEGER_LIMIT_RULES = new Set(['minLength', 'maxLength', 'minItems', 'maxItems'])

type Kind = 'string' | 'number' | 'boolean' | 'array'

interface ParsedRule {
  readonly name: string
  readonly limit?: number
  readonly options?: readonly string[]
}

function parseRule(field: string, rule: unknown, problems: string[]): ParsedRule | undefined {
  if (typeof rule !== 'string') {
    problems.push(`field "${field}": every rule must be a string`)
    return undefined
  }

  const separator = rule.indexOf(':')
  const name = separator === -1 ? rule : rule.slice(0, separator)

  if (!RULE_NAMES.has(name)) {
    problems.push(
      `field "${field}": unknown rule "${rule}". RiserBob's Validator has no custom rules, so it cannot be documented`,
    )
    return undefined
  }

  if (name === 'enum') {
    if (separator === -1) {
      problems.push(`field "${field}": rule "enum" requires options (e.g. "enum:active,pending")`)
      return undefined
    }
    const options = rule
      .slice(separator + 1)
      .split(',')
      .map((option) => option.trim())

    if (options.some((option) => option === '') || new Set(options).size !== options.length) {
      problems.push(`field "${field}": invalid enum rule "${rule}" (empty or duplicate option)`)
      return undefined
    }
    return { name, options }
  }

  if (!LIMIT_RULES.has(name)) {
    if (separator !== -1) {
      problems.push(`field "${field}": rule "${name}" does not accept a limit`)
      return undefined
    }
    return { name }
  }

  if (separator === -1) {
    problems.push(`field "${field}": rule "${name}" requires a limit`)
    return undefined
  }

  const rawLimit = rule.slice(separator + 1)
  if (!/^\d+(?:\.\d+)?$/.test(rawLimit)) {
    problems.push(`field "${field}": invalid limit in "${rule}"`)
    return undefined
  }

  const limit = Number(rawLimit)
  if (!Number.isFinite(limit) || (INTEGER_LIMIT_RULES.has(name) && !Number.isInteger(limit))) {
    problems.push(`field "${field}": rule "${name}" requires a finite integer limit`)
    return undefined
  }

  return { name, limit }
}

function kindOf(names: ReadonlySet<string>): { kinds: Set<Kind> } {
  const kinds = new Set<Kind>()
  if (names.has('string') || names.has('email') || names.has('url') || names.has('enum')) {
    kinds.add('string')
  }
  if (names.has('number')) kinds.add('number')
  if (names.has('boolean')) kinds.add('boolean')
  if (names.has('array')) kinds.add('array')
  return { kinds }
}

function convertField(field: string, rawRules: unknown, problems: string[]): ConvertedField[] {
  if (!Array.isArray(rawRules)) {
    problems.push(`field "${field}": rules must be an array of strings`)
    return []
  }

  const before = problems.length
  const rules: ParsedRule[] = []
  for (const raw of rawRules as readonly unknown[]) {
    const parsed = parseRule(field, raw, problems)
    if (parsed) rules.push(parsed)
  }
  if (problems.length > before) return []

  const names = new Set(rules.map((rule) => rule.name))
  const required = names.has('required')
  const nullable = names.has('nullable')

  if (required && nullable) {
    problems.push(`field "${field}": "required" and "nullable" cannot be combined`)
    return []
  }

  const { kinds } = kindOf(names)
  if (kinds.size > 1) {
    problems.push(
      `field "${field}": incompatible type rules (${[...kinds].join(', ')}) — no value can satisfy them`,
    )
    return []
  }
  const kind: Kind | undefined = kinds.values().next().value

  let minimum: number | undefined
  let maximum: number | undefined
  let minLength: number | undefined
  let maxLength: number | undefined
  let minItems: number | undefined
  let maxItems: number | undefined

  const pickMax = (current: number | undefined, next: number): number =>
    current === undefined ? next : Math.max(current, next)
  const pickMin = (current: number | undefined, next: number): number =>
    current === undefined ? next : Math.min(current, next)

  for (const rule of rules) {
    const limit = rule.limit
    if (limit === undefined) continue

    switch (rule.name) {
      case 'min':
      case 'max': {
        const isMin = rule.name === 'min'
        if (kind === 'number') {
          if (isMin) minimum = pickMax(minimum, limit)
          else maximum = pickMin(maximum, limit)
        } else if (kind === 'string') {
          if (isMin) minLength = pickMax(minLength, Math.ceil(limit))
          else maxLength = pickMin(maxLength, Math.floor(limit))
        } else {
          problems.push(
            `field "${field}": "${rule.name}" needs a "string" or "number" type rule to be documented`,
          )
        }
        break
      }
      case 'minLength':
      case 'maxLength':
        if (kind !== 'string') {
          problems.push(`field "${field}": "${rule.name}" requires a string type rule`)
        } else if (rule.name === 'minLength') {
          minLength = pickMax(minLength, limit)
        } else {
          maxLength = pickMin(maxLength, limit)
        }
        break
      case 'minItems':
      case 'maxItems':
        if (kind !== 'array') {
          problems.push(`field "${field}": "${rule.name}" requires the "array" rule`)
        } else if (rule.name === 'minItems') {
          minItems = pickMax(minItems, limit)
        } else {
          maxItems = pickMin(maxItems, limit)
        }
        break
      default:
        break
    }
  }
  if (problems.length > before) return []

  const schema: { -readonly [K in keyof JsonSchema]: JsonSchema[K] } = {}

  if (kind !== undefined) {
    schema.type = nullable ? ([kind, 'null'] satisfies JsonSchemaTypeName[]) : kind
  }

  if (names.has('email')) schema.format = 'email'
  if (names.has('url')) {
    schema.format = 'uri'
    schema.pattern = '^https?://'
  }

  const enumRule = rules.find((rule) => rule.name === 'enum')
  if (enumRule?.options !== undefined) {
    schema.enum = nullable ? [...enumRule.options, null] : [...enumRule.options]
  }

  // The Validator treats empty / whitespace-only strings as missing for required fields.
  if (required && names.has('string') && !names.has('enum')) {
    minLength = pickMax(minLength, 1)
  }

  if (minLength !== undefined) schema.minLength = minLength
  if (maxLength !== undefined) schema.maxLength = maxLength
  if (minimum !== undefined) schema.minimum = minimum
  if (maximum !== undefined) schema.maximum = maximum
  if (minItems !== undefined) schema.minItems = minItems
  if (maxItems !== undefined) schema.maxItems = maxItems

  const converted: ConvertedField[] = [{ name: field, required, schema }]

  // `confirmed` makes the Validator compare the value with `<field>Confirmation`.
  if (names.has('confirmed')) {
    const { minLength: _ml, maxLength: _xl, ...confirmationSchema } = schema
    converted.push({
      name: `${field}Confirmation`,
      required,
      schema: { ...confirmationSchema, description: `Must be identical to "${field}".` },
    })
  }

  return converted
}

/**
 * Converts a RiserBob validation schema to a JSON Schema object (OpenAPI 3.1).
 *
 * Conversions are only produced for rules the RiserBob `Validator` really
 * enforces. Anything that cannot be represented faithfully throws a
 * `SchemaConversionError` instead of being silently dropped.
 */
export function convertSchema(schema: unknown): ConvertedSchema {
  if (!isRecord(schema)) {
    throw new SchemaConversionError(['schema must be an object mapping field names to rule arrays'])
  }

  const problems: string[] = []
  const fields: ConvertedField[] = []
  const names = new Set<string>()

  for (const [field, rules] of Object.entries(schema)) {
    if (field === '' || field === '__proto__') {
      problems.push(`invalid field name "${field}"`)
      continue
    }
    for (const converted of convertField(field, rules, problems)) {
      // An explicitly declared "<field>Confirmation" wins over the derived one.
      if (names.has(converted.name)) continue
      names.add(converted.name)
      fields.push(converted)
    }
  }

  if (problems.length > 0) throw new SchemaConversionError(problems)

  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  for (const field of fields) {
    properties[field.name] = field.schema
    if (field.required) required.push(field.name)
  }

  const objectSchema: JsonObjectSchema = {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }

  return { fields, objectSchema }
}
