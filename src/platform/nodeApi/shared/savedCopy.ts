import { reportError } from '@comfyorg/telemetry/reportError'

/** A frozen copy of `value` as a workflow would save it, or `undefined` if it cannot be saved. */
export type SavedCopier = <T>(member: string, value: T) => T | undefined

/** Each copier reports the first value of each member that cannot be saved, and no more. */
export function savedCopier(): SavedCopier {
  const reported = new Set<string>()
  return (member, value) => {
    let saved: { value: typeof value }
    try {
      saved = JSON.parse(JSON.stringify({ value }))
    } catch (error) {
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
    return deepFreeze(saved.value)
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
