import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import type { RemovableRef, StorageLike } from '@vueuse/core'

import { getStorageScope } from '../base/storageIO'
import type { StorageScope } from '../base/storageKeys'

const UNRESOLVED_KEY_PREFIX = '__comfy_unresolved__:'
let unresolvedKeyId = 0

function createDeferredLocalStorage(unresolvedKey: string): StorageLike {
  return {
    getItem(key) {
      return key === unresolvedKey ? null : localStorage.getItem(key)
    },
    removeItem(key) {
      if (key !== unresolvedKey) localStorage.removeItem(key)
    },
    setItem(key, value) {
      if (key !== unresolvedKey) localStorage.setItem(key, value)
    }
  }
}

/**
 * Persists only after the storage scope resolves. In Cloud builds that requires
 * both auth and workspace identity; non-Cloud builds resolve `personal`
 * immediately. Before then, the returned ref remains usable in memory without
 * minting an ambiguous key.
 */
export function useScopedLocalStorage<T>(
  keyForScope: (scope: StorageScope) => string,
  defaults: T
): RemovableRef<T> {
  const unresolvedKey = `${UNRESOLVED_KEY_PREFIX}${unresolvedKeyId++}`
  const deferredLocalStorage = createDeferredLocalStorage(unresolvedKey)
  const key = computed(() => {
    const scope = getStorageScope()
    return scope ? keyForScope(scope) : unresolvedKey
  })
  return useStorage(key, defaults, deferredLocalStorage)
}
