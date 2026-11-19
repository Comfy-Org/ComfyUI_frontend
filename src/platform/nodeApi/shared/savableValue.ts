import { invalidArgument } from './invalidArgument'

/** A value a workflow saves as it is: text, a finite number, a boolean, `null`, or a plain object or array of those. */
export type SavableValue =
  | string
  | number
  | boolean
  | null
  | readonly SavableValue[]
  | { readonly [key: string]: SavableValue }

const SAVABLE =
  'a string, a finite number, a boolean, null, or a plain object or array of those'

type IsLeaf = (value: object) => boolean

const noLeaf: IsLeaf = () => false

const MAX_DEPTH = 1000

class Unsavable {
  constructor(
    readonly path: string,
    readonly value: unknown,
    readonly tooDeep = false
  ) {}
}

/** A copy of `value` made in one pass, or a `TypeError` naming `member` and the part of `path` the workflow cannot save. */
export function savableValue(
  member: string,
  value: unknown,
  path = 'value'
): SavableValue {
  try {
    return copyOf(value, path, new Set(), noLeaf) as SavableValue
  } catch (error) {
    if (!(error instanceof Unsavable)) throw error
    const needed = error.tooDeep
      ? `${path} nested at most ${MAX_DEPTH} deep`
      : `${error.path} as ${SAVABLE}`
    throw invalidArgument(member, needed, error.value)
  }
}

/** A frozen copy of `value`, keeping any object `isLeaf` accepts as it is, or `undefined` if it holds anything else. */
export function frozenSavable(value: unknown): SavableValue | undefined
export function frozenSavable(value: unknown, isLeaf: IsLeaf): unknown
export function frozenSavable(
  value: unknown,
  isLeaf: IsLeaf = noLeaf
): unknown {
  try {
    return deepFreeze(copyOf(value, '', new Set(), isLeaf), isLeaf)
  } catch (error) {
    if (error instanceof Unsavable) return undefined
    throw error
  }
}

export function isSavable(value: unknown): value is SavableValue {
  try {
    copyOf(value, '', new Set(), noLeaf)
    return true
  } catch (error) {
    if (error instanceof Unsavable) return false
    throw error
  }
}

function copyOf(
  value: unknown,
  path: string,
  ancestors: Set<object>,
  isLeaf: IsLeaf
): unknown {
  if (value === null || typeof value === 'string') return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    throw new Unsavable(path, value)
  }
  if (typeof value !== 'object') throw new Unsavable(path, value)
  if (isLeaf(value)) return value
  const isList = Array.isArray(value)
  if ((!isList && !isPlainData(value)) || ancestors.has(value)) {
    throw new Unsavable(path, value)
  }
  if (ancestors.size === MAX_DEPTH) throw new Unsavable(path, value, true)
  ancestors.add(value)
  const copy: Record<string, unknown> = isList ? Object.assign([]) : {}
  for (const key of Object.keys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key)
    const fieldPath = isList ? `${path}[${key}]` : `${path}.${key}`
    if (!field || !('value' in field)) {
      throw new Unsavable(fieldPath, field?.get ?? field?.set)
    }
    const item = copyOf(field.value, fieldPath, ancestors, isLeaf)
    if (key === '__proto__') {
      Object.defineProperty(copy, key, {
        value: item,
        enumerable: true,
        writable: true,
        configurable: true
      })
    } else copy[key] = item
  }
  ancestors.delete(value)
  return copy
}

function deepFreeze(value: unknown, isLeaf: IsLeaf): unknown {
  if (typeof value !== 'object' || value === null || isLeaf(value)) {
    return value
  }
  for (const item of Object.values(value)) deepFreeze(item, isLeaf)
  return Object.freeze(value)
}

/** True for an object literal or an object with no prototype, and nothing else. */
export function isPlainData(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
