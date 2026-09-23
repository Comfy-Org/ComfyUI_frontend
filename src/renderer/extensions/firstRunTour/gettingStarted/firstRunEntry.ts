import {
  breakpointsTailwind,
  createSharedComposable,
  until,
  useBreakpoints
} from '@vueuse/core'
import { readonly, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import {
  consumeFirstRunReplayRequest,
  isFirstRunReplayRequested
} from '@/platform/onboarding/onboardingReplay'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import type { SharedWorkflowUrlLoadStatus } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useNewUserService } from '@/services/useNewUserService'
import { useCommandStore } from '@/stores/commandStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

/** Waiters give up after this; a healthy boot settles well inside it. */
const STARTUP_DECISION_TIMEOUT_MS = 60_000

/**
 * Decides what a first-time user sees once startup reports its outcome: the
 * Getting Started screen for first-run tour candidates, the template browser
 * for everyone else.
 */
export const useFirstRunEntry = createSharedComposable(() => {
  const settingStore = useSettingStore()
  const gettingStartedVisible = ref(false)
  const startupDecided = ref(false)
  const firstRunTookScreen = ref(false)
  const isDesktopWidth =
    useBreakpoints(breakpointsTailwind).greaterOrEqual('md')

  /**
   * `defer` is ineligibility a later boot can lift — the tour flag, the
   * viewport, remote config that has not arrived. `Comfy.TutorialCompleted` is
   * write-once and server-side, so only `complete` may set it.
   */
  type FirstRunDecision = 'getting-started' | 'defer' | 'complete'

  function decideFirstRun(): FirstRunDecision {
    if (!isCloud) return 'complete'

    // A replay stands in for the new-user checks rather than satisfying them:
    // they read local draft history, which is the user's work, not onboarding
    // state, and so is never cleared to re-open this gate.
    const isNewUser =
      isFirstRunReplayRequested() || useNewUserService().isNewUser()
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
    try {
      await showFirstRunScreen(outcome)
    } finally {
      if (outcome !== 'url-intent') startupDecided.value = true
    }
  }

  async function showFirstRunScreen(outcome: StartupOutcome) {
    const decision = decideFirstRun()

    // Restored work and a spent tutorial are the two reasons to withhold
    // onboarding from someone who did not ask for it. A replay is someone
    // asking, so it overrides both — but only once this boot can actually
    // serve the screen, or the fall-through below would cover their restored
    // work with the template browser instead.
    const isReplay =
      isFirstRunReplayRequested() && decision === 'getting-started'
    if (!isReplay) {
      if (outcome === 'restored') return
      if (settingStore.get('Comfy.TutorialCompleted')) return
    }

    if (outcome === 'url-intent') {
      if (decision === 'complete') await markTutorialCompleted()
      return
    }

    if (decision === 'getting-started') {
      gettingStartedVisible.value = true
      // Spent where the screen is actually delivered, so a boot that could not
      // show it leaves the request standing for the next one.
      consumeFirstRunReplayRequest()
      firstRunTookScreen.value = true
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
    try {
      if (outcome !== 'url-intent' || !isFirstRunCandidate()) return
      const shareLoaded =
        sharedStatus === 'loaded' || sharedStatus === 'loaded-without-assets'
      if (templateId === undefined && !shareLoaded) return
      const started = await useFirstRunTourController().beginTour(
        shareLoaded ? undefined : templateId
      )
      if (!started) return
      firstRunTookScreen.value = true
      consumeFirstRunReplayRequest()
      await markTutorialCompleted()
    } finally {
      startupDecided.value = true
    }
  }

  let startupDecision: Promise<boolean> | undefined
  /** True once this boot's first-run stages have run, false if the grace period passes first. */
  function whenStartupDecided(): Promise<boolean> {
    if (startupDecided.value) return Promise.resolve(true)
    startupDecision ??= until(startupDecided).toBe(true, {
      timeout: STARTUP_DECISION_TIMEOUT_MS,
      throwOnTimeout: false
    })
    return startupDecision
  }

  // Applied locally before the request, so a failed write is next launch's problem.
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
    firstRunTookScreen: readonly(firstRunTookScreen),
    whenStartupDecided,
    handleStartupOutcome,
    handleUrlWorkflow,
    dismissGettingStarted
  }
})
