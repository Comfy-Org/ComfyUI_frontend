import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { isPlainData } from '@/platform/nodeApi/shared/savableValue'

/** True for a name a host plain object can use as a key: a non-empty string that no object inherits. */
export function isStoreKey(value: unknown): value is string {
  return (
    typeof value === 'string' && value !== '' && !(value in Object.prototype)
  )
}

/**
 * The own fields of a plain object a pack passed, each read once. Refuses any
 * other value, and a field not in `known`; a field in `ignored` reads as absent.
 */
export function checkedFields<TField extends string>(
  member: string,
  what: string,
  value: unknown,
  known: Readonly<Record<TField, true>>,
  ignored: readonly string[] = []
): Readonly<Record<string, unknown>> {
  if (!isPlainData(value)) {
    throw invalidArgument(member, `${what} as a plain object`, value)
  }
  const given: Record<string, unknown> = { ...value }
  for (const field of Object.keys(given)) {
    if (ignored.includes(field)) delete given[field]
    else if (!Object.hasOwn(known, field)) {
      throw invalidArgument(
        member,
        `${what} of ${Object.keys(known).join(', ')} only`,
        field
      )
    }
  }
  return given
}

/** A function a pack passed, or `undefined`; refuses anything else. The API cannot check its signature. */
export function optionalCallback(
  member: string,
  field: string,
  value: unknown
): ((...args: never[]) => unknown) | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'function') {
    throw invalidArgument(member, `${field} as a function`, value)
  }
  return value as (...args: never[]) => unknown
}
