import { isPlainObject } from 'es-toolkit'

/** True for a value that holds only what JSON can, and any object `isLeaf` accepts. */
export function isJsonValue(
  value: unknown,
  isLeaf: (value: object) => boolean = () => false,
  holders: Set<object> = new Set()
): boolean {
  if (value === null || typeof value === 'string') return true
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (isLeaf(value)) return true
  if (!Array.isArray(value) && !isPlainObject(value)) return false
  if (holders.has(value)) return false
  holders.add(value)
  const holdsOnlyJson = Object.values(value).every((item) =>
    isJsonValue(item, isLeaf, holders)
  )
  holders.delete(value)
  return holdsOnlyJson
}

/** A frozen copy of every list and plain object in `value`; anything else is kept as it is. */
export function frozenJsonCopy<T>(value: T): T
export function frozenJsonCopy(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(frozenJsonCopy))
  if (!isPlainObject(value)) return value
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, frozenJsonCopy(item)])
    )
  )
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
