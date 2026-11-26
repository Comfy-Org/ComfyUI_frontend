import { reportError } from '@comfyorg/telemetry/reportError'

import type { SavableValue } from './savableValue'

export type SavedRecord = { readonly [key: string]: SavableValue }

/** A frozen copy of `value` as a workflow would save it, or of `record[field]` read and saved under `field`; `undefined` if it cannot be read or saved. */
export interface SavedCopier {
  (member: string, value: unknown): SavableValue | undefined
  (member: string, record: object, field: string): SavableValue | undefined
}

type SavedValue =
  | { ok: true; value: SavableValue | undefined }
  | { ok: false; error: unknown }

function savedValue(holder: object, key: string): SavedValue {
  try {
    const saved: { readonly [key: string]: SavableValue | undefined } =
      JSON.parse(JSON.stringify(holder))
    return {
      ok: true,
      value: Object.hasOwn(saved, key) ? deepFreeze(saved[key]) : undefined
    }
  } catch (error) {
    return { ok: false, error }
  }
}

function fieldHolder(record: object, field: string): object {
  return Object.defineProperty({}, field, {
    enumerable: true,
    get: () => Reflect.get(record, field)
  })
}

/** Each copier reports the first value of each member that cannot be saved, and no more. */
export function savedCopier(): SavedCopier {
  const reported = new Set<string>()
  return (member: string, value: unknown, field?: string) => {
    const saved =
      field !== undefined && typeof value === 'object' && value !== null
        ? savedValue(fieldHolder(value, field), field)
        : savedValue({ value }, 'value')
    if (saved.ok) return saved.value
    if (!reported.has(member)) {
      reported.add(member)
      reportError(saved.error, {
        errorType: 'node_api_property_not_savable',
        surface: 'platform',
        level: 'warning',
        tags: { member }
      })
    }
    return undefined
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
