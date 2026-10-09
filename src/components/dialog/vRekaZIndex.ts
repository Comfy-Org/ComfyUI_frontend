import { ZIndex } from '@primeuix/utils/zindex'
import type { Directive } from 'vue'

/** Shared modal stacking sequence; later registrations cover earlier ones. */
export const MODAL_Z_KEY = 'modal'
export const MODAL_Z_BASE = 1700

// Dialogs and other overlays open in any order, and each portals with the
// same static z-1700 class. Registering an element with the shared ZIndex
// counter (key 'modal', base 1700) gives every open overlay its own step in
// one stacking sequence, so whichever opened last covers the rest.
export const vRekaZIndex: Directive<HTMLElement> = {
  mounted(el) {
    ZIndex.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
  },
  updated(el, { value, oldValue }) {
    if (value === oldValue) return
    ZIndex.clear(el)
    ZIndex.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
  },
  beforeUnmount(el) {
    ZIndex.clear(el)
  }
}
