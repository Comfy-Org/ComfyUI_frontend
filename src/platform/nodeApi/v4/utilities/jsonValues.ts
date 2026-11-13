import { isPlainObject } from 'es-toolkit'

/** True for a value JSON can hold: no function, class instance, cycle or number that is not finite. */
export function isJsonValue(
  value: unknown,
  holders: Set<object> = new Set()
): boolean {
  if (value === null || typeof value === 'string') return true
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (!Array.isArray(value) && !isPlainObject(value)) return false
  if (holders.has(value)) return false
  holders.add(value)
  const holdsOnlyJson = Object.values(value).every((item) =>
    isJsonValue(item, holders)
  )
  holders.delete(value)
  return holdsOnlyJson
}

/** `key` of each object in a list a server answered, or `undefined` if one has no string there. */
export function textFieldOfEach(
  reply: unknown,
  key: string
): string[] | undefined {
  if (!Array.isArray(reply)) return undefined
  const fields = reply.map((entry: unknown) =>
    typeof entry === 'object' && entry !== null
      ? Reflect.get(entry, key)
      : undefined
  )
  return fields.every((field) => typeof field === 'string') ? fields : undefined
}
