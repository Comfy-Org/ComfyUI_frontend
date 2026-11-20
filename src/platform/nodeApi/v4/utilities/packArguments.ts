import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'

export type Check<T> = (value: unknown) => value is T

/** The fields of a plain object a pack passed, read once. One of the wrong type throws. */
export interface PackObject<TField extends string = string> {
  required<T>(key: TField, check: Check<T>, needed: string): T
  optional<T>(key: TField, check: Check<T>, needed: string): T | undefined
}

/**
 * Refuses anything but a plain object of `known` fields, as `checkedFields` does,
 * naming its fields in errors as `prefix` plus the key.
 */
export function packObject<TField extends string>(
  member: string,
  needed: string,
  value: unknown,
  known: Readonly<Record<TField, true>>,
  prefix = '',
  ignored: readonly string[] = []
): PackObject<TField> {
  const given = checkedFields(member, needed, value, known, ignored)
  const fieldOf = (key: string): unknown =>
    Object.hasOwn(given, key) ? given[key] : undefined

  function checked<T>(
    key: string,
    field: unknown,
    check: Check<T>,
    fieldNeeded: string
  ): T {
    if (check(field)) return field
    throw invalidArgument(member, `${prefix}${key} as ${fieldNeeded}`, field)
  }

  return {
    required: (key, check, fieldNeeded) =>
      checked(key, fieldOf(key), check, fieldNeeded),
    optional(key, check, fieldNeeded) {
      const field = fieldOf(key)
      return field === undefined
        ? undefined
        : checked(key, field, check, fieldNeeded)
    }
  }
}

export function isText(value: unknown): value is string {
  return typeof value === 'string'
}

export function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** A name a host store can key a plain object by: not a member every object inherits. */
export function isStoreKey(value: unknown): value is string {
  return isName(value) && !(value in Object.prototype)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

export function isCallback(
  value: unknown
): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

export function listOf<T>(check: Check<T>): Check<readonly T[]> {
  return (value): value is readonly T[] =>
    isList(value) && Array.from(value).every(check)
}
