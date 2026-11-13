import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'

export type Check<T> = (value: unknown) => value is T

/** The fields of an object a pack passed. Each is read once, and one of the wrong type throws. */
export interface PackObject {
  required<T>(key: string, check: Check<T>, needed: string): T
  optional<T>(key: string, check: Check<T>, needed: string): T | undefined
}

/** Refuses anything but an object, naming its fields in errors as `prefix` plus the key. */
export function packObject(
  member: string,
  needed: string,
  value: unknown,
  prefix = ''
): PackObject {
  if (!isObject(value)) throw invalidArgument(member, needed, value)
  const target = value

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
      checked(key, Reflect.get(target, key), check, fieldNeeded),
    optional(key, check, fieldNeeded) {
      const field: unknown = Reflect.get(target, key)
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
