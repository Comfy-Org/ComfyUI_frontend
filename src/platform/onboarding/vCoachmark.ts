import type { Directive } from 'vue'

import { registerCoachmark, unregisterCoachmark } from './coachmarkRegistry'
import type { CoachId } from './onboardingTours'

/**
 * Marks an element as a coach-mark target. Registers it in the reactive
 * registry the tour overlay reads, and mirrors the id to `data-coach-id` so
 * e2e locators and rect overrides keep working. A falsy value is a no-op, so it
 * can be bound to a conditional id (e.g. only some sidebar tabs).
 */
export const vCoachmark: Directive<HTMLElement, CoachId | undefined | null> = {
  mounted(el, { value }) {
    if (!value) return
    el.dataset.coachId = value
    registerCoachmark(value, el)
  },
  updated(el, { value, oldValue }) {
    if (value === oldValue) return
    if (oldValue) {
      unregisterCoachmark(oldValue, el)
      if (el.dataset.coachId === oldValue) delete el.dataset.coachId
    }
    if (value) {
      el.dataset.coachId = value
      registerCoachmark(value, el)
    }
  },
  unmounted(el, { value }) {
    if (!value) return
    unregisterCoachmark(value, el)
    if (el.dataset.coachId === value) delete el.dataset.coachId
  }
}
