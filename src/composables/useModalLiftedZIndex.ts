import type { InjectionKey, Ref } from 'vue'
import { computed, inject } from 'vue'

import { zIndexManager } from '@/utils/zIndexManager'

export const overlayZIndexKey: InjectionKey<number> = Symbol('overlayZIndex')

const MODAL_BASE_Z_INDEX = 1700

export function useModalLiftedZIndex(open: Ref<boolean>) {
  const parentZIndex = inject(overlayZIndexKey, 0)
  return computed(() => {
    if (!open.value) return undefined
    const topZIndex = Math.max(zIndexManager.getCurrent('modal'), parentZIndex)
    return topZIndex >= MODAL_BASE_Z_INDEX
      ? { zIndex: topZIndex + 1 }
      : undefined
  })
}
