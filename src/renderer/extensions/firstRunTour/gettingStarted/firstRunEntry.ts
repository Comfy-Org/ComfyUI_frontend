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
  const isMdOrLarger = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')

  const isCandidate = () =>
    isCloud &&
    isMdOrLarger.value &&
    useSubscription().isSubscriptionEnabled() &&
    useNewUserService().isNewUser() === true &&
    useFeatureFlags().flags.onboardingTourEnabled

  async function handleStartupOutcome(outcome: StartupOutcome) {
    if (import.meta.env.DEV)
      console.warn('[first-run] outcome:', outcome, {
        force: localStorage.getItem('ff:force_first_run'),
        cloud: isCloud,
        newUser: useNewUserService().isNewUser(),
        flag: useFeatureFlags().flags.onboardingTourEnabled
      })
    if (
      import.meta.env.DEV &&
      localStorage.getItem('ff:force_first_run') === 'true'
    ) {
      await useSettingStore().set('Comfy.TutorialCompleted', false)
      await useSettingStore().set(TOUR_SEEN_SETTING, [])
      gettingStartedVisible.value = true
      if (import.meta.env.DEV) console.warn('[first-run] forced takeover on')
      return
    }
    if (outcome === 'restored') return
    if (outcome === 'fresh' && isCandidate()) {
      gettingStartedVisible.value = true
      return
    }
    await useSettingStore().set('Comfy.TutorialCompleted', true)
    if (outcome === 'fresh')
      await useCommandStore().execute('Comfy.BrowseTemplates')
  }

  function hideGettingStarted() {
    gettingStartedVisible.value = false
  }

  async function fallBackToBrowse() {
    hideGettingStarted()
    await useSettingStore().set('Comfy.TutorialCompleted', true)
    await useCommandStore().execute('Comfy.BrowseTemplates')
  }

  async function dismissGettingStarted() {
    hideGettingStarted()
    await useSettingStore()
      .set('Comfy.TutorialCompleted', true)
      .catch(console.error)
  }

  return {
    gettingStartedVisible: readonly(gettingStartedVisible),
    handleStartupOutcome,
    hideGettingStarted,
    fallBackToBrowse,
    dismissGettingStarted
  }
})
