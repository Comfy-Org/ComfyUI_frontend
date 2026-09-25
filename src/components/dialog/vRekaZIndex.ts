import type { Directive } from 'vue'

import { zIndexManager } from '@/utils/zIndexManager'

/** Shared modal stacking sequence; later registrations cover earlier ones. */
export const MODAL_Z_KEY = 'modal'
export const MODAL_Z_BASE = 1700
/** Toasts stay above every modal layer, whichever opened first. */
export const TOAST_Z_INDEX = 9999

export const vRekaZIndex: Directive<HTMLElement> = {
  mounted(el) {
    zIndexManager.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
  },
  updated(el, { value, oldValue }) {
    if (value === oldValue) return
    zIndexManager.clear(el)
    zIndexManager.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
  },
  beforeUnmount(el) {
    zIndexManager.clear(el)
  }
}
