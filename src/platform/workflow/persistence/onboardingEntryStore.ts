import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useNewUserService } from '@/services/useNewUserService'

/**
 * Whether this session is an onboarding candidate.
 *
 * The Getting Started screen and the tour must agree: the screen dismisses even
 * when the tour then declines, so a looser gate on either side strands the user
 * on a bare canvas. Both read this so they cannot drift apart.
 */
export function isOnboardingCandidate(): boolean {
  if (!isCloud) return false
  if (!useSubscription().isSubscriptionEnabled()) return false
  if (useNewUserService().isNewUser() !== true) return false
  if (!useFeatureFlags().flags.onboardingTourEnabled) return false
  return true
}

/**
 * Seam between the persistence layer and the onboarding Getting Started screen.
 *
 * `loadDefaultWorkflow` decides when a fresh user should land on Getting
 * Started, but the screen lives in `renderer/` and cannot be imported from this
 * layer. Both sides share this flag: persistence turns it on; the
 * renderer-mounted overlay shows itself while set and clears it on exit.
 */
export const useOnboardingEntryStore = defineStore('onboardingEntry', () => {
  const shouldShowGettingStarted = ref(false)

  function showGettingStarted() {
    shouldShowGettingStarted.value = true
  }

  function dismissGettingStarted() {
    shouldShowGettingStarted.value = false
  }

  return { shouldShowGettingStarted, showGettingStarted, dismissGettingStarted }
})
