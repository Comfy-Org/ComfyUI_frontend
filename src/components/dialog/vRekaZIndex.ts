import type { Directive } from 'vue'

import { zIndexManager } from '@/utils/zIndexManager'

/** Shared modal stacking sequence; later registrations cover earlier ones. */
export const MODAL_Z_KEY = 'modal'
export const MODAL_Z_BASE = 1700

export const vRekaZIndex: Directive<HTMLElement> = {
  mounted(el) {
    zIndexManager.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
  },
  beforeUnmount(el) {
    zIndexManager.clear(el)
  }
}
