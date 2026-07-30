import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints
} from '@vueuse/core'
import { readonly, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { TOUR_SEEN_SETTING } from '@/platform/onboarding/onboardingTours'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import { useNewUserService } from '@/services/useNewUserService'
import { useCommandStore } from '@/stores/commandStore'

export const useFirstRunEntry = createSharedComposable(() => {
  const gettingStartedVisible = ref(false)

  const isCandidate = () =>
    isCloud &&
    useBreakpoints(breakpointsTailwind).greaterOrEqual('md').value &&
    useSubscription().isSubscriptionEnabled() &&
    useNewUserService().isNewUser() === true &&
    useFeatureFlags().flags.onboardingTourEnabled

  async function handleStartupOutcome(outcome: StartupOutcome) {
    if (
      import.meta.env.DEV &&
      localStorage.getItem('ff:force_first_run') === 'true'
    ) {
      await useSettingStore().set('Comfy.TutorialCompleted', false)
      await useSettingStore().set(TOUR_SEEN_SETTING, [])
      gettingStartedVisible.value = true
      return
    }
    if (outcome !== 'fresh') return
    if (isCandidate()) {
      gettingStartedVisible.value = true
      return
    }
    await useCommandStore().execute('Comfy.BrowseTemplates')
  }

  async function dismissGettingStarted() {
    gettingStartedVisible.value = false
    await useSettingStore().set('Comfy.TutorialCompleted', true)
  }

  return {
    gettingStartedVisible: readonly(gettingStartedVisible),
    handleStartupOutcome,
    dismissGettingStarted
  }
})
