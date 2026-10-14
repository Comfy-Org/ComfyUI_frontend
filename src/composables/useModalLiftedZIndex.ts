import type { InjectionKey, Ref } from 'vue'
import { computed, inject } from 'vue'

import { MODAL_Z_BASE, topModalZIndex } from '@/utils/modalLayerStack'

export const overlayZIndexKey: InjectionKey<number> = Symbol('overlayZIndex')

export function useModalLiftedZIndex(open: Ref<boolean>) {
  const parentZIndex = inject(overlayZIndexKey, 0)
  return computed(() => {
    if (!open.value) return undefined
    const topZIndex = Math.max(topModalZIndex(), parentZIndex)
    return topZIndex >= MODAL_Z_BASE ? { zIndex: topZIndex + 1 } : undefined
  })
}
