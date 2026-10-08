import { ZIndex } from '@primeuix/utils/zindex'
import type { Directive } from 'vue'

/** Shared PrimeVue/Reka modal stacking sequence; later registrations cover earlier ones. */
export const MODAL_Z_KEY = 'modal'
export const MODAL_Z_BASE = 1700

/** Backdrop-tier surfaces (dialog priority < 1) sit below every modal-band dialog. */
export const BACKDROP_Z = MODAL_Z_BASE - 100

const isBackdropTier = (priority: number | undefined) => (priority ?? 1) < 1

// Both Reka and PrimeVue dialogs can appear at any depth in dialogStack, in
// any order. PrimeVue auto-increments a per-key z-index counter so later
// dialogs always cover earlier ones; Reka uses a static z-1700 class which
// can lose to an already-open PrimeVue dialog. Registering Reka's content
// element with the same ZIndex counter (key 'modal', base 1700) makes both
// renderers share one stacking sequence: whichever dialog opens last wins.
//
// The optional binding value is the dialog's stack priority. A priority < 1
// marks a backdrop takeover (e.g. Getting Started) that must never cover a
// real dialog whatever the mount order, so it gets a static z below the band
// instead of joining the counter.
export const vRekaZIndex: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (isBackdropTier(binding.value)) {
      el.style.zIndex = String(BACKDROP_Z)
      return
    }
    ZIndex.set(MODAL_Z_KEY, el, MODAL_Z_BASE)
  },
  beforeUnmount(el, binding) {
    if (isBackdropTier(binding.value)) return
    ZIndex.clear(el)
  }
}
