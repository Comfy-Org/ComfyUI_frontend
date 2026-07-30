import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints
} from '@vueuse/core'
import { readonly, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import { useNewUserService } from '@/services/useNewUserService'
import { useCommandStore } from '@/stores/commandStore'

export const useFirstRunEntry = createSharedComposable(() => {
  const gettingStartedVisible = ref(false)
  const isMdOrLarger = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')

  const isCandidate = () =>
    useFeatureFlags().flags.onboardingTourEnabled &&
    isCloud &&
    isMdOrLarger.value &&
    useNewUserService().isNewUser() === true

  async function handleStartupOutcome(outcome: StartupOutcome) {
    if (outcome === 'restored') return
    if (outcome === 'fresh' && isCandidate()) {
      gettingStartedVisible.value = true
      return
    }
    if (outcome === 'fresh')
      await useCommandStore().execute('Comfy.BrowseTemplates')
    await useSettingStore().set('Comfy.TutorialCompleted', true)
  }

  function hideGettingStarted() {
    gettingStartedVisible.value = false
  }

  async function fallBackToBrowse() {
    hideGettingStarted()
    await useCommandStore().execute('Comfy.BrowseTemplates')
    await useSettingStore().set('Comfy.TutorialCompleted', true)
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
