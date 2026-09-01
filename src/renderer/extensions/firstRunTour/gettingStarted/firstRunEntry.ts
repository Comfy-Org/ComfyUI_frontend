import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints
} from '@vueuse/core'
import { computed, defineAsyncComponent } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import type { SharedWorkflowUrlLoadStatus } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useNewUserService } from '@/services/useNewUserService'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

export const GETTING_STARTED_DIALOG_KEY = 'global-getting-started'

const GettingStartedScreen = defineAsyncComponent(
  () => import('./GettingStartedScreen.vue')
)

/**
 * Decides what a first-time user sees once startup reports its outcome: the
 * Getting Started screen for first-run tour candidates, the template browser
 * for everyone else.
 */
export const useFirstRunEntry = createSharedComposable(() => {
  const settingStore = useSettingStore()
  const dialogStore = useDialogStore()
  const gettingStartedVisible = computed(() =>
    dialogStore.isDialogOpen(GETTING_STARTED_DIALOG_KEY)
  )
  const isDesktopWidth =
    useBreakpoints(breakpointsTailwind).greaterOrEqual('md')

  /**
   * A backdrop-tier (priority 0) dialog-stack entry: real dialogs (desktop
   * sign-in approval, invite links) always stack above it and own focus while
   * they are up. Any close path — Escape, programmatic — lands in `onClose`.
   */
  function showGettingStarted() {
    dialogStore.showDialog({
      key: GETTING_STARTED_DIALOG_KEY,
      component: GettingStartedScreen,
      priority: 0,
      dialogComponentProps: {
        headless: true,
        modal: false,
        showCloseButton: false,
        dismissableMask: false,
        dismissOnFocusOutside: false,
        contentClass:
          'inset-0 top-0 left-0 size-full max-h-none max-w-none translate-none rounded-none border-none shadow-none sm:max-w-none',
        onClose: () => void markTutorialCompleted()
      }
    })
  }

  /**
   * `defer` is ineligibility a later boot can lift — the tour flag, the
   * viewport, remote config that has not arrived. `Comfy.TutorialCompleted` is
   * write-once and server-side, so only `complete` may set it.
   */
  type FirstRunDecision = 'getting-started' | 'defer' | 'complete'

  function decideFirstRun(): FirstRunDecision {
    if (!isCloud) return 'complete'

    const isNewUser = useNewUserService().isNewUser()
    if (isNewUser === false) return 'complete'

    if (!useFeatureFlags().flags.onboardingTourEnabled) return 'defer'
    if (!isDesktopWidth.value) return 'defer'
    if (!useSubscription().isSubscriptionEnabled()) return 'defer'
    if (isNewUser === null) return 'defer'

    return 'getting-started'
  }

  function isFirstRunCandidate(): boolean {
    return decideFirstRun() === 'getting-started'
  }

  // `url-intent` defers to handleUrlWorkflow: we don't know yet whether
  // anything arrived to tour, and TutorialCompleted is write-once.
  async function handleStartupOutcome(outcome: StartupOutcome) {
    if (outcome === 'restored') return
    if (settingStore.get('Comfy.TutorialCompleted')) return

    const decision = decideFirstRun()

    if (outcome === 'url-intent') {
      if (decision === 'complete') await markTutorialCompleted()
      return
    }

    if (decision === 'getting-started') {
      showGettingStarted()
      return
    }

    if (decision === 'complete') await markTutorialCompleted()
    await useCommandStore().execute('Comfy.BrowseTemplates')
  }

  /**
   * A share or template link loads its workflow instead of the Getting Started
   * screen, so the tour is offered over whatever arrived. The engine declines
   * to repeat a tour the user has already seen.
   *
   * A tour that actually started is what `Comfy.TutorialCompleted` pays for, so
   * only that writes it. A link that loaded nothing, or a start the engine
   * refused, leaves the account eligible: the next boot has no URL to honour and
   * offers Getting Started, which is the onboarding this one failed to deliver.
   */
  async function handleUrlWorkflow(
    outcome: StartupOutcome | undefined,
    templateId?: string,
    sharedStatus?: SharedWorkflowUrlLoadStatus
  ) {
    if (outcome !== 'url-intent' || !isFirstRunCandidate()) return
    const shareLoaded =
      sharedStatus === 'loaded' || sharedStatus === 'loaded-without-assets'
    if (templateId === undefined && !shareLoaded) return
    const started = await useFirstRunTourController().beginTour(
      shareLoaded ? undefined : templateId
    )
    if (started) await markTutorialCompleted()
  }

  // Applied locally before the request, so a failed write is next launch's problem.
  async function markTutorialCompleted() {
    try {
      await settingStore.set('Comfy.TutorialCompleted', true)
    } catch (error) {
      console.error('Failed to persist Comfy.TutorialCompleted', error)
    }
  }

  function dismissGettingStarted() {
    dialogStore.closeDialog({ key: GETTING_STARTED_DIALOG_KEY })
  }

  return {
    gettingStartedVisible,
    handleStartupOutcome,
    handleUrlWorkflow,
    dismissGettingStarted
  }
})
