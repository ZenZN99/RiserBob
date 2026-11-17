import type { ValidationSchema } from 'riser-bob'

/**
 * A RiserBob validation schema, exactly as accepted by `Validator.validate`
 * (e.g. the result of `defineSchema({ name: rules(['required', 'string']) })`).
 */
export type RiserBobSchema = ValidationSchema

export type JsonSchemaTypeName = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'

/** The subset of JSON Schema (draft 2020-12, as used by OpenAPI 3.1) this library emits. */
export interface JsonSchema {
  type?: JsonSchemaTypeName | readonly JsonSchemaTypeName[]
  format?: 'email' | 'uri'
  pattern?: string
  enum?: readonly (string | null)[]
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  description?: string
  properties?: Readonly<Record<string, JsonSchema>>
  required?: readonly string[]
}

export interface JsonObjectSchema extends JsonSchema {
  type: 'object'
  properties: Readonly<Record<string, JsonSchema>>
}

/** One converted field of a RiserBob schema. */
export interface ConvertedField {
  readonly name: string
  readonly required: boolean
  readonly schema: JsonSchema
}

/** Result of converting a RiserBob schema. */
export interface ConvertedSchema {
  readonly fields: readonly ConvertedField[]
  readonly objectSchema: JsonObjectSchema
}
