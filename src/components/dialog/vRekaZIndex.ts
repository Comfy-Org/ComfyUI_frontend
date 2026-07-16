import { ZIndex } from '@primeuix/utils/zindex'
import type { Directive } from 'vue'

/** Shared PrimeVue/Reka modal stacking sequence; later registrations cover earlier ones. */
export const MODAL_Z_KEY = 'modal'
export const MODAL_Z_BASE = 1700

// Both Reka and PrimeVue dialogs can appear at any depth in dialogStack, in
// any order. PrimeVue auto-increments a per-key z-index counter so later
// dialogs always cover earlier ones; Reka uses a static z-1700 class which
// can lose to an already-open PrimeVue dialog. Registering Reka's content
// element with the same ZIndex counter (key 'modal', base 1700) makes both
// renderers share one stacking sequence: whichever dialog opens last wins.
export const vRekaZIndex: Directive<HTMLElement> = {
  mounted(el) {
    ZIndex.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
  },
  beforeUnmount(el) {
    ZIndex.clear(el)
  }
}
