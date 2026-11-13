import { reportError } from '@comfyorg/telemetry/reportError'

/** A frozen copy of `value` as a workflow would save it, or `undefined` if it cannot be saved. */
export type SavedCopier = <T>(member: string, value: T) => T | undefined

type SavedValue<T> = { ok: true; value: T } | { ok: false; error: unknown }

function savedValue<T>(value: T): SavedValue<T> {
  try {
    const saved: { value: T } = JSON.parse(JSON.stringify({ value }))
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

/** A frozen copy of `value` as a workflow would save it. Throws for a value it cannot save. */
export function savedCopy<T>(value: T): T {
  const saved = savedValue(value)
  if (!saved.ok) throw saved.error
  return saved.value
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
