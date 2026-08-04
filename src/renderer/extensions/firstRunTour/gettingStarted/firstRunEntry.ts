import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints
} from '@vueuse/core'
import { readonly, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import { useNewUserService } from '@/services/useNewUserService'
import { useCommandStore } from '@/stores/commandStore'

/**
 * Decides what a first-time user sees once startup reports its outcome: the
 * Getting Started screen for first-run tour candidates, the template browser
 * for everyone else.
 */
export const useFirstRunEntry = createSharedComposable(() => {
  const settingStore = useSettingStore()
  const gettingStartedVisible = ref(false)
  const isDesktopWidth =
    useBreakpoints(breakpointsTailwind).greaterOrEqual('md')

  function isFirstRunCandidate(): boolean {
    if (!useFeatureFlags().flags.onboardingTourEnabled) return false
    if (!isCloud) return false
    if (!isDesktopWidth.value) return false
    if (!useSubscription().isSubscriptionEnabled()) return false
    return useNewUserService().isNewUser() === true
  }

  /**
   * Candidacy is read once, here: a later breakpoint, flag or subscription
   * change must not unmount the screen out from under the user.
   * Only a boot that opened a blank canvas can be onboarded over. `isNewUser()`
   * cannot carry that alone — it reads `Comfy.TutorialCompleted`, which is
   * exactly what a user predating the setting is missing.
   */
  async function handleStartupOutcome(outcome: StartupOutcome) {
    if (outcome === 'restored') return
    if (settingStore.get('Comfy.TutorialCompleted')) return

    if (outcome === 'url-intent') {
      await markTutorialCompleted()
      return
    }

    if (isFirstRunCandidate()) {
      gettingStartedVisible.value = true
      return
    }

    await markTutorialCompleted()
    await useCommandStore().execute('Comfy.BrowseTemplates')
  }

  async function markTutorialCompleted() {
    try {
      await settingStore.set('Comfy.TutorialCompleted', true)
    } catch (error) {
      console.error('Failed to persist Comfy.TutorialCompleted', error)
    }
  }

  async function dismissGettingStarted() {
    gettingStartedVisible.value = false
    await markTutorialCompleted()
  }

  return {
    gettingStartedVisible: readonly(gettingStartedVisible),
    handleStartupOutcome,
    dismissGettingStarted
  }
})
