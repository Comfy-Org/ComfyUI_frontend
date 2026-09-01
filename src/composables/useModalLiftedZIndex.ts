import { ZIndex } from '@primeuix/utils/zindex'
import type { Ref } from 'vue'
import { computed } from 'vue'

// Shared base for @primeuix's auto-incrementing 'modal' z-index counter.
const MODAL_BASE_Z_INDEX = 1700

/**
 * Inline z-index style for body-portaled popover/menu content. Such content
 * keeps its static `z-1700` class unless a dialog that joined @primeuix's
 * auto-incrementing 'modal' counter (Reka and PrimeVue dialogs both do, via
 * `v-reka-z-index` or PrimeVue's mask) is open above it; then lift past that
 * dialog so the content isn't hidden behind the dialog or its scrim.
 */
export function useModalLiftedZIndex(open: Ref<boolean>) {
  return computed(() => {
    if (!open.value) return undefined
    const topZIndex = ZIndex.getCurrent('modal')
    return topZIndex >= MODAL_BASE_Z_INDEX
      ? { zIndex: topZIndex + 1 }
      : undefined
  })
}
