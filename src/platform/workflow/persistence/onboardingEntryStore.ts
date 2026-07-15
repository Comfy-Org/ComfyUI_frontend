import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import type { useNewUserService } from '@/services/useNewUserService'

export interface OnboardingCandidateDeps {
  subscription: ReturnType<typeof useSubscription>
  newUserService: ReturnType<typeof useNewUserService>
  featureFlags: ReturnType<typeof useFeatureFlags>
}

/**
 * Shared by the Getting Started screen and the tour: the screen dismisses even
 * when the tour then declines, so a looser gate on either side strands the user
 * on a bare canvas. Deps are resolved by callers during setup — this runs after
 * an await, where a first composable call would have no injection context.
 */
export function isOnboardingCandidate({
  subscription,
  newUserService,
  featureFlags
}: OnboardingCandidateDeps): boolean {
  if (!isCloud) return false
  if (!subscription.isSubscriptionEnabled()) return false
  if (newUserService.isNewUser() !== true) return false
  if (!featureFlags.flags.onboardingTourEnabled) return false
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
