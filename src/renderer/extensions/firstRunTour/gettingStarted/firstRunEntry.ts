import {
  breakpointsTailwind,
  createSharedComposable,
  until,
  useBreakpoints
} from '@vueuse/core'
import { computed, readonly, ref, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import {
  consumeFirstRunReplayRequest,
  isFirstRunReplayRequested
} from '@/platform/onboarding/onboardingReplay'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type {
  FirstRunScreenDismissMethod,
  FirstRunScreenDismissedMetadata,
  FirstRunTourOutcome
} from '@/platform/telemetry/types'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import type { SharedWorkflowUrlLoadStatus } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useNewUserService } from '@/services/useNewUserService'
import { useAuthStore } from '@/stores/authStore'
import { useCommandStore } from '@/stores/commandStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

const STARTUP_DECISION_TIMEOUT_MS = 60_000

export const useFirstRunEntry = createSharedComposable(() => {
  const authStore = useAuthStore()
  const settingStore = useSettingStore()
  const gettingStartedVisible = ref(false)
  const startupDecided = ref(false)
  const firstRunTookScreen = ref(false)
  /**
   * Handoffs out of the screen that are still in flight. Counted rather than a
   * flag so an overlapping handoff cannot clear a hold it does not own.
   */
  const tourHandoffs = ref(0)
  const isDesktopWidth =
    useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
  let gettingStartedShownAt: number | null = null

  /**
   * A close that has happened but has not been reported yet, because on the
   * template path what to report about it is not known until the tour it handed
   * the screen to has answered.
   */
  type PendingDismissal = Pick<
    FirstRunScreenDismissedMetadata,
    'method' | 'visible_duration_ms'
  >

  /**
   * The screen's only exit. Every hide routes through here, so the dismissal is
   * reported once per visible → hidden transition rather than once per caller:
   * a repeated hide of an already-hidden screen returns `null`, which is what
   * keeps the count a count of closes instead of a function of session length.
   *
   * Measuring here and reporting from {@link reportDismissal} keeps those two
   * guarantees separate: the duration is always measured to the hide, even when
   * the report waits for a handoff.
   */
  function closeGettingStarted(
    method: FirstRunScreenDismissMethod
  ): PendingDismissal | null {
    if (!gettingStartedVisible.value) return null
    gettingStartedVisible.value = false
    const shownAt = gettingStartedShownAt
    gettingStartedShownAt = null
    return {
      method,
      visible_duration_ms: shownAt === null ? null : Date.now() - shownAt
    }
  }

  /** Reports a close once, with what became of the tour it handed off to. */
  function reportDismissal(
    dismissal: PendingDismissal | null,
    tourOutcome: FirstRunTourOutcome
  ): void {
    if (!dismissal) return
    useTelemetry()?.trackFirstRunScreenDismissed({
      ...dismissal,
      tour_outcome: tourOutcome
    })
  }

  /**
   * Whether the first run still owns the screen. A different question from
   * "is the Getting Started screen rendered", and the one anything deciding
   * whether the screen is free has to ask: the template path hands the screen
   * straight to the coachmark tour, and that tour does not exist yet at the
   * moment the screen goes. `beginTour` leaves the chosen workflow undimmed for
   * `INTRO_PREVIEW_MS` before it starts the tour — pinned by
   * `useFirstRunTourController.test.ts`, "leaves the workflow undimmed before
   * taking the screen over" — so `gettingStartedVisible` is already `false`
   * while no tour is active yet. Anything reading that as a free screen puts
   * itself into the intro preview, in front of the tour about to open over it.
   */
  const firstRunHoldsScreen = computed(
    () => gettingStartedVisible.value || tourHandoffs.value > 0
  )

  watch(
    () => authStore.userId,
    (userId, previousUserId) => {
      if (previousUserId === undefined || userId === previousUserId) return
      reportDismissal(closeGettingStarted('user_changed'), 'not_attempted')
      firstRunTookScreen.value = false
      const tourStore = useOnboardingTourStore()
      if (tourStore.activeTour === 'firstRun') tourStore.postpone()
    },
    { flush: 'sync' }
  )

  type FirstRunDecision = 'getting-started' | 'defer' | 'complete'

  function decideFirstRun(): FirstRunDecision {
    if (!isCloud) return 'complete'

    const isNewUser =
      isFirstRunReplayRequested(authStore.userId) ||
      useNewUserService().isNewUser()
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

  async function handleStartupOutcome(outcome: StartupOutcome) {
    try {
      await showFirstRunScreen(outcome)
    } finally {
      if (outcome !== 'url-intent') startupDecided.value = true
    }
  }

  async function showFirstRunScreen(outcome: StartupOutcome) {
    const decision = decideFirstRun()

    const isReplay =
      isFirstRunReplayRequested(authStore.userId) &&
      decision === 'getting-started'
    if (!isReplay) {
      if (outcome === 'restored') return
      if (settingStore.get('Comfy.TutorialCompleted')) return
    }

    if (outcome === 'url-intent') {
      if (decision === 'complete') await markTutorialCompleted()
      return
    }

    if (decision === 'getting-started') {
      gettingStartedShownAt = Date.now()
      gettingStartedVisible.value = true
      consumeFirstRunReplayRequest(authStore.userId)
      firstRunTookScreen.value = true
      return
    }

    if (decision === 'complete') await markTutorialCompleted()
    await useCommandStore().execute('Comfy.BrowseTemplates')
  }

  async function handleUrlWorkflow(
    outcome: StartupOutcome | undefined,
    templateId?: string,
    sharedStatus?: SharedWorkflowUrlLoadStatus
  ) {
    try {
      if (!isTourableUrlWorkflow(outcome, templateId, sharedStatus)) return
      const shareLoaded = isSharedWorkflowLoaded(sharedStatus)
      const ownerId = authStore.userId
      // `=== 'started'`, not truthiness: every refusal is a non-empty string.
      const tourOutcome = await useFirstRunTourController().beginTour(
        shareLoaded ? undefined : templateId,
        () => authStore.userId !== ownerId
      )
      if (tourOutcome !== 'started') return
      firstRunTookScreen.value = true
      consumeFirstRunReplayRequest(ownerId)
      await markTutorialCompleted()
    } finally {
      startupDecided.value = true
    }
  }

  function isTourableUrlWorkflow(
    outcome: StartupOutcome | undefined,
    templateId?: string,
    sharedStatus?: SharedWorkflowUrlLoadStatus
  ): boolean {
    if (outcome !== 'url-intent' || !isFirstRunCandidate()) return false
    return templateId !== undefined || isSharedWorkflowLoaded(sharedStatus)
  }

  function isSharedWorkflowLoaded(
    status: SharedWorkflowUrlLoadStatus | undefined
  ): boolean {
    return status === 'loaded' || status === 'loaded-without-assets'
  }

  let startupDecision: Promise<boolean> | undefined
  function whenStartupDecided(): Promise<boolean> {
    if (startupDecided.value) return Promise.resolve(true)
    startupDecision ??= until(startupDecided).toBe(true, {
      timeout: STARTUP_DECISION_TIMEOUT_MS,
      throwOnTimeout: false
    })
    return startupDecision
  }

  async function markTutorialCompleted() {
    try {
      await settingStore.set('Comfy.TutorialCompleted', true)
    } catch (error) {
      reportError(error, {
        errorType: 'failure_writing_tutorial_completed_setting',
        level: 'warning'
      })
    }
  }

  /**
   * The exits that leave the canvas clear. Two methods are deliberately out of
   * reach: `user_changed`, because only the account watcher above closes the
   * screen without the user acting on it, and `template_selected`, because a
   * close reported from here would have no tour outcome to report and a
   * hand-written `not_attempted` would be a lie — that path is
   * {@link dismissIntoFirstRunTour}.
   *
   * Reported before the completion write is awaited, not after: a hung write
   * would otherwise drop the event and lose a denominator row while whatever is
   * held behind the screen still goes on to be offered.
   */
  async function dismissGettingStarted(
    method: Exclude<
      FirstRunScreenDismissMethod,
      'user_changed' | 'template_selected'
    >
  ) {
    reportDismissal(closeGettingStarted(method), 'not_attempted')
    await markTutorialCompleted()
  }

  /**
   * The template path out of Getting Started: drop the screen, then tour the
   * workflow it just loaded. Both halves live behind one call so the gap
   * between them cannot be read as a free screen — see
   * {@link firstRunHoldsScreen} for what is in that gap and why it matters.
   * Rejects with whatever the tour threw; the screen is already gone and the
   * graph is already loaded, so the caller decides what a failed tour means.
   *
   * This is also the only place that can report a `template_selected` close
   * honestly, so it reports it — once, when the handoff settles rather than
   * when the screen hides. Without that, the one method whose close does not
   * free the screen is the one method whose event cannot say whether it did:
   * `beginTour` is the only thing that knows, and it does not answer for
   * `INTRO_PREVIEW_MS`. The cost is the report riding out the handoff, so a
   * page that goes away inside it loses the row — bounded to this method, and
   * to a window that ends when the tour opens.
   */
  async function dismissIntoFirstRunTour(templateId: string): Promise<void> {
    tourHandoffs.value++
    const dismissal = closeGettingStarted('template_selected')
    // Only overwritten by an outcome `beginTour` actually returned, so a throw
    // anywhere in the handoff reports itself rather than a refusal it invented.
    let tourOutcome: FirstRunTourOutcome = 'error'
    try {
      await markTutorialCompleted()
      tourOutcome = await useFirstRunTourController().beginTour(templateId)
    } finally {
      tourHandoffs.value--
      reportDismissal(dismissal, tourOutcome)
    }
  }

  return {
    gettingStartedVisible: readonly(gettingStartedVisible),
    firstRunHoldsScreen,
    firstRunTookScreen: readonly(firstRunTookScreen),
    whenStartupDecided,
    handleStartupOutcome,
    handleUrlWorkflow,
    dismissGettingStarted,
    dismissIntoFirstRunTour
  }
})
