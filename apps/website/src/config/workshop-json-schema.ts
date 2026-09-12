import Ajv from 'ajv'
import type { ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { isHttpImageSource } from './workshop-image-source'

export type WorkshopJsonParseResult =
  | { readonly success: true; readonly value: unknown }
  | { readonly success: false }

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
ajv.addFormat('http-image-url', { type: 'string', validate: isHttpImageSource })
ajv.addFormat('uint32', {
  type: 'number',
  validate: (value) =>
    Number.isInteger(value) && value >= 0 && value <= 4_294_967_295
})
const validators = new WeakMap<
  Readonly<Record<string, unknown>>,
  ValidateFunction
>()

export function validatorFor(
  schema: Readonly<Record<string, unknown>>
): ValidateFunction {
  const existing = validators.get(schema)
  if (existing) return existing

  const validator = ajv.compile(normalizeOpenApiSchema(schema))
  validators.set(schema, validator)
  return validator
}

function isSchema(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeOpenApiSchema(
  schema: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const result = { ...schema }
  for (const key of [
    'properties',
    'patternProperties',
    'definitions',
    '$defs'
  ]) {
    const map = result[key]
    if (isSchema(map))
      result[key] = Object.fromEntries(
        Object.entries(map).map(([name, value]) => [
          name,
          isSchema(value) ? normalizeOpenApiSchema(value) : value
        ])
      )
  }
  for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
    const list = result[key]
    if (Array.isArray(list))
      result[key] = list.map((value) =>
        isSchema(value) ? normalizeOpenApiSchema(value) : value
      )
  }
  for (const key of [
    'items',
    'additionalProperties',
    'not',
    'contains',
    'if',
    'then',
    'else'
  ]) {
    const value = result[key]
    if (isSchema(value)) result[key] = normalizeOpenApiSchema(value)
  }
  if (isSchema(result.components) && isSchema(result.components.schemas)) {
    result.components = {
      ...result.components,
      schemas: Object.fromEntries(
        Object.entries(result.components.schemas).map(([name, value]) => [
          name,
          isSchema(value) ? normalizeOpenApiSchema(value) : value
        ])
      )
    }
  }
  for (const [exclusive, inclusive] of [
    ['exclusiveMinimum', 'minimum'],
    ['exclusiveMaximum', 'maximum']
  ]) {
    if (typeof result[exclusive] === 'boolean') {
      if (result[exclusive] && typeof result[inclusive] === 'number')
        result[exclusive] = result[inclusive]
      else delete result[exclusive]
    }
  }
  if (result.type === undefined && result.nullable === true) {
    delete result.nullable
    if (
      typeof result.$ref === 'string' ||
      ['allOf', 'oneOf', 'anyOf'].some((key) => Array.isArray(result[key]))
    )
      return { anyOf: [{ type: 'null' }, result] }
  }
  if (result.type === undefined) delete result.nullable
  return result
}

export function validateWorkshopInput(
  value: unknown,
  schema: Readonly<Record<string, unknown>>
): boolean {
  try {
    if (
      schema.type === 'integer' &&
      typeof value === 'number' &&
      !Number.isSafeInteger(value)
    )
      return false
    return validatorFor(schema)(value)
  } catch {
    return false
  }
}

export function parseWorkshopJsonInput(
  rawValue: string,
  schema: Readonly<Record<string, unknown>>
): WorkshopJsonParseResult {
  try {
    const value: unknown = JSON.parse(rawValue)
    return validateWorkshopInput(value, schema)
      ? { success: true, value }
      : { success: false }
  } catch {
    return { success: false }
  }
}
