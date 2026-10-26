import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import type { RemovableRef, StorageLike } from '@vueuse/core'

import { getStorageScope } from '@/platform/workflow/persistence/base/storageIO'
import type { StorageScope } from '@/platform/workflow/persistence/base/draftTypes'

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
