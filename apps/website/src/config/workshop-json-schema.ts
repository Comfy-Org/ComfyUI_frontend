import Ajv from 'ajv'
import type { ValidateFunction } from 'ajv'

export type WorkshopJsonParseResult =
  | { readonly success: true; readonly value: unknown }
  | { readonly success: false }

const ajv = new Ajv({ allErrors: true, strict: false })
const validators = new WeakMap<
  Readonly<Record<string, unknown>>,
  ValidateFunction
>()

function validatorFor(
  schema: Readonly<Record<string, unknown>>
): ValidateFunction {
  const existing = validators.get(schema)
  if (existing) return existing

  const validator = ajv.compile(schema)
  validators.set(schema, validator)
  return validator
}

/** Parse a JSON form value and validate it against the Router's full schema. */
export function parseWorkshopJsonInput(
  rawValue: string,
  schema: Readonly<Record<string, unknown>>
): WorkshopJsonParseResult {
  try {
    const value: unknown = JSON.parse(rawValue)
    return validatorFor(schema)(value)
      ? { success: true, value }
      : { success: false }
  } catch {
    return { success: false }
  }
}
