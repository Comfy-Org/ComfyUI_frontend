import { createSharedComposable } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNewUserService } from '@/services/useNewUserService'

function _useOnboardingTourController() {
  /**
   * Whether the onboarding tour should run for this session. Cloud-only, gated
   * behind the feature flag, shown once per user via `Comfy.TutorialCompleted`.
   */
  function shouldStartTour(): boolean {
    if (!isCloud) return false
    if (!useSubscription().isSubscriptionEnabled()) return false
    if (useNewUserService().isNewUser() !== true) return false
    if (!useFeatureFlags().flags.onboardingTourEnabled) return false
    if (useSettingStore().get('Comfy.TutorialCompleted')) return false
    return true
  }

  return { shouldStartTour }
}

export const useOnboardingTourController = createSharedComposable(
  _useOnboardingTourController
)
