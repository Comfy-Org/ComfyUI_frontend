import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'

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

export function checkedFinite(
  member: string,
  field: string,
  value: unknown
): number {
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

const POINT_FIELDS = { x: true, y: true } as const

/** A point `{ x, y }` of finite numbers, as the host's `[x, y]`. */
export function checkedPoint(
  member: string,
  field: string,
  value: unknown
): [number, number] {
  const { x, y } = checkedFields(member, field, value, POINT_FIELDS)
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
  return value === undefined || value === null
    ? undefined
    : checkedString(member, field, value)
}
