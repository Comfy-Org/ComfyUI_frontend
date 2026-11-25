import { useStorage } from '@vueuse/core'
import type { RemovableRef, StorageLike, UseStorageOptions } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'

import {
  safeLocalStorage,
  safeSessionStorage
} from '@/base/storage/safeStorage'

export function useSafeLocalStorage<T>(
  key: MaybeRefOrGetter<string>,
  defaults: MaybeRefOrGetter<T>,
  options?: UseStorageOptions<T>,
  storage: StorageLike = safeLocalStorage.asStorage()
): RemovableRef<T> {
  return useStorage(key, defaults, storage, options)
}

export function useSafeSessionStorage<T>(
  key: MaybeRefOrGetter<string>,
  defaults: MaybeRefOrGetter<T>,
  options?: UseStorageOptions<T>
): RemovableRef<T> {
  return useStorage(key, defaults, safeSessionStorage.asStorage(), options)
}
