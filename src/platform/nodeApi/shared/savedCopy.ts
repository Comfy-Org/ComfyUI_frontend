import { reportError } from '@comfyorg/telemetry/reportError'

import type { SavableValue } from './savableValue'

export type SavedRecord = { readonly [key: string]: SavableValue }

/** A frozen copy of `value` as a workflow saves it under `key`, or `undefined` if it cannot be saved. */
export type SavedCopier = (
  member: string,
  value: unknown,
  key?: string
) => SavableValue | undefined

type SavedValue =
  | { ok: true; value: SavableValue | undefined }
  | { ok: false; error: unknown }

function savedValue(value: unknown, key = 'value'): SavedValue {
  try {
    const saved: { readonly [key: string]: SavableValue | undefined } =
      JSON.parse(JSON.stringify({ [key]: value }))
    return { ok: true, value: deepFreeze(saved[key]) }
  } catch (error) {
    return { ok: false, error }
  }
}

/** Each copier reports the first value of each member that cannot be saved, and no more. */
export function savedCopier(): SavedCopier {
  const reported = new Set<string>()
  return (member, value, key) => {
    const saved = savedValue(value, key)
    if (!saved.ok) {
      const { error } = saved
      if (!reported.has(member)) {
        reported.add(member)
        reportError(error, {
          errorType: 'node_api_property_not_savable',
          surface: 'platform',
          level: 'warning',
          tags: { member }
        })
      }
      return undefined
    }
    return saved.value
  }
}

/** `copy` if it is an object of fields, `undefined` for any other saved value. */
export function savedRecord(
  copy: SavableValue | undefined
): SavedRecord | undefined {
  return typeof copy === 'object' && copy !== null && !isSavedList(copy)
    ? copy
    : undefined
}

function isSavedList(value: SavableValue): value is readonly SavableValue[] {
  return Array.isArray(value)
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
