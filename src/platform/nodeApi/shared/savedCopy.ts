import { reportError } from '@comfyorg/telemetry/reportError'

import type { SavableValue } from './savableValue'

export type SavedRecord = { readonly [key: string]: SavableValue }

/** A frozen copy of `value` as a workflow would save it, or `undefined` if it cannot be saved. */
export type SavedCopier = (
  member: string,
  value: unknown
) => SavableValue | undefined

type SavedValue =
  | { ok: true; value: SavableValue | undefined }
  | { ok: false; error: unknown }

function savedValue(value: unknown): SavedValue {
  try {
    const saved: { value?: SavableValue } = JSON.parse(
      JSON.stringify({ value })
    )
    return { ok: true, value: deepFreeze(saved.value) }
  } catch (error) {
    return { ok: false, error }
  }
}

/** Each copier reports the first value of each member that cannot be saved, and no more. */
export function savedCopier(): SavedCopier {
  const reported = new Set<string>()
  return (member, value) => {
    const saved = savedValue(value)
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
