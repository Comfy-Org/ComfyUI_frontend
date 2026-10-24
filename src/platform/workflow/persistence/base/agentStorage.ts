import type { StorageLike } from '@vueuse/core'

import { StorageKeys } from './storageKeys'

function legacyKeys(key: string): { owned: string[]; unowned: string[] } {
  const separator = key.indexOf(':')
  if (separator < 0) return { owned: [], unowned: [] }
  const prefix = key.slice(0, separator)
  const identity: unknown = JSON.parse(
    decodeURIComponent(key.slice(separator + 1))
  )
  if (
    !Array.isArray(identity) ||
    identity.length !== 2 ||
    !identity.every((part): part is string => typeof part === 'string')
  )
    return { owned: [], unowned: [] }
  const [workspaceId, userId] = identity
  const owned =
    key === StorageKeys.agentOnboarded(key.slice(separator + 1))
      ? [`${prefix}.${userId}.${workspaceId}`]
      : key ===
          StorageKeys.agentFreeUseNoticeDismissed(key.slice(separator + 1))
        ? [`${prefix}.${userId}`]
        : []
  return {
    owned,
    unowned: [
      prefix,
      `${prefix}:${workspaceId}`,
      ...(prefix === 'Comfy.Agent.WorkflowTabBindings' ? [`${prefix}.v2`] : []),
      ...(prefix === 'Comfy.Agent.RunModePreference'
        ? ['Comfy.Agent.RunMode', 'Comfy.Agent.RunCreditLimit']
        : [])
    ]
  }
}

export const agentStorage: StorageLike = {
  getItem(key) {
    if (!key) return null
    let value = localStorage.getItem(key)
    const { owned, unowned } = legacyKeys(key)
    for (const legacy of owned) {
      const previous = localStorage.getItem(legacy)
      if (value === null && previous !== null) {
        localStorage.setItem(key, previous)
        value = previous
      }
      localStorage.removeItem(legacy)
    }
    for (const legacy of unowned) localStorage.removeItem(legacy)
    return value
  },
  setItem(key, value) {
    if (key) localStorage.setItem(key, value)
  },
  removeItem(key) {
    if (key) localStorage.removeItem(key)
  }
}
