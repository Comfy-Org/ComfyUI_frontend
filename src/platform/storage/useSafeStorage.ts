import { useStorage } from '@vueuse/core'
import type { RemovableRef, UseStorageOptions } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'

import {
  safeLocalStorage,
  safeSessionStorage
} from '@comfyorg/shared-frontend-utils/safeStorage'

/** VueUse `useStorage` bound to `safeLocalStorage`; never throws when storage is blocked. */
export function useSafeLocalStorage<T>(
  key: MaybeRefOrGetter<string>,
  defaults: MaybeRefOrGetter<T>,
  options?: UseStorageOptions<T>
): RemovableRef<T> {
  return useStorage(key, defaults, safeLocalStorage.asStorage(), options)
}

export function useSafeSessionStorage<T>(
  key: MaybeRefOrGetter<string>,
  defaults: MaybeRefOrGetter<T>,
  options?: UseStorageOptions<T>
): RemovableRef<T> {
  return useStorage(key, defaults, safeSessionStorage.asStorage(), options)
}
