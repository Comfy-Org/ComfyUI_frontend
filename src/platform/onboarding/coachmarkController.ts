import { createEventHook } from '@vueuse/core'

import type { EntryPath } from './onboardingTours'

/**
 * A tour the user has explicitly asked to (re)play — e.g. via an info button —
 * as opposed to one that auto-starts on detection. TourOverlay listens for the
 * request and starts the tour past its seen-flag and gates.
 */
const tourRequested = createEventHook<EntryPath>()

export function useCoachmarkController() {
  return {
    requestTour: (entryPath: EntryPath) => tourRequested.trigger(entryPath),
    onTourRequested: tourRequested.on
  }
}
