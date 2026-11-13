import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'
import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

/** A copy of a plain object whose keys are all in `fields`, each read once; anything else throws. */
export function checkedFields(
  member: string,
  patch: unknown,
  fields: Readonly<Record<string, true>>
): Readonly<Record<string, unknown>> {
  if (!isPlainObject(patch)) {
    throw invalidArgument(member, 'a plain object of fields', patch)
  }
  const given: Readonly<Record<string, unknown>> = { ...patch }
  const unknownField = Object.keys(given).find(
    (field) => !Object.hasOwn(fields, field)
  )
  if (unknownField !== undefined) {
    throw invalidArgument(
      member,
      `fields among ${Object.keys(fields).join(', ')}`,
      unknownField
    )
  }
  return given
}

export function checkedString(
  member: string,
  field: string,
  value: unknown
): string {
  if (typeof value !== 'string') {
    throw invalidArgument(member, `${field} as a string`, value)
  }
  return value
}

export function checkedBoolean(
  member: string,
  field: string,
  value: unknown
): boolean {
  if (typeof value !== 'boolean') {
    throw invalidArgument(member, `${field} as true or false`, value)
  }
  return value
}

function checkedFinite(member: string, field: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidArgument(member, `${field} as a finite number`, value)
  }
  return value
}

export function checkedNonNegative(
  member: string,
  field: string,
  value: unknown
): number {
  const number = checkedFinite(member, field, value)
  if (number < 0) {
    throw invalidArgument(member, `${field} of zero or more`, value)
  }
  return number
}

/** One of the names a lookup table has, as its key. */
export function checkedChoice<TName extends string>(
  member: string,
  field: string,
  value: unknown,
  choices: Readonly<Record<TName, unknown>>
): TName {
  if (!isChoice(value, choices)) {
    throw invalidArgument(
      member,
      `${field} of ${Object.keys(choices).join(', ')}`,
      value
    )
  }
  return value
}

function isChoice<TName extends string>(
  value: unknown,
  choices: Readonly<Record<TName, unknown>>
): value is TName {
  return typeof value === 'string' && Object.hasOwn(choices, value)
}

/** The fields of an object a pack passed, read once. */
export function fieldsOf(
  member: string,
  field: string,
  value: unknown
): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    throw invalidArgument(member, `${field} as an object`, value)
  }
  return { ...value }
}

/** A point `{ x, y }` of finite numbers, as the host's `[x, y]`. */
export function checkedPoint(
  member: string,
  field: string,
  value: unknown
): [number, number] {
  const { x, y } = fieldsOf(member, field, value)
  return [
    checkedFinite(member, `${field}.x`, x),
    checkedFinite(member, `${field}.y`, y)
  ]
}

/** A string, or `undefined` to clear the value. */
export function checkedOptionalString(
  member: string,
  field: string,
  value: unknown
): string | undefined {
  return value === undefined ? undefined : checkedString(member, field, value)
}

/** The copy of `value` the workflow would save. Refuses a value it cannot save. */
export function savableCopy(
  member: string,
  field: string,
  value: unknown
): NodeProperty {
  const saved = jsonRoundTrip(value)
  if (saved === undefined) {
    throw invalidArgument(member, `${field} the workflow can save`, value)
  }
  return saved
}

function jsonRoundTrip(value: unknown): NodeProperty | undefined {
  try {
    const saved: { value?: NodeProperty } = JSON.parse(
      JSON.stringify({ value })
    )
    return saved.value
  } catch {
    return undefined
  }
}
