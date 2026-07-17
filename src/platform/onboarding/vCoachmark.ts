import type { Directive } from 'vue'

import { registerCoachmark, unregisterCoachmark } from './coachmarkRegistry'
import type { CoachId } from './onboardingTours'

// The element's `data-coach-id` is the record of what it is registered as.
function sync(el: HTMLElement, id: CoachId | undefined | null) {
  const prev = el.dataset.coachId as CoachId | undefined
  if (prev === id) return
  if (prev) {
    unregisterCoachmark(prev, el)
    delete el.dataset.coachId
  }
  if (id) {
    el.dataset.coachId = id
    registerCoachmark(id, el)
  }
}

/**
 * Marks an element as a coach-mark target: registers it in the reactive
 * registry and mirrors the id to `data-coach-id` for e2e locators. A falsy
 * value is a no-op, so it can be bound to a conditional id.
 */
export const vCoachmark: Directive<HTMLElement, CoachId | undefined | null> = {
  mounted: (el, { value }) => sync(el, value),
  updated: (el, { value }) => sync(el, value),
  unmounted: (el) => sync(el, null)
}
