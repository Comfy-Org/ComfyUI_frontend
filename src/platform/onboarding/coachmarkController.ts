import { createEventHook } from '@vueuse/core'

import type { EntryPath } from './onboardingTours'

// An explicit request to (re)play a tour, which starts it past its seen-flag.
const tourRequested = createEventHook<EntryPath>()

export const requestTour = tourRequested.trigger
export const onTourRequested = tourRequested.on
