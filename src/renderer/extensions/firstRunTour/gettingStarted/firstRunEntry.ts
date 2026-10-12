import {
  breakpointsTailwind,
  createSharedComposable,
  until,
  useBreakpoints
} from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import {
  consumeFirstRunReplayRequest,
  isFirstRunReplayRequested
} from '@/platform/onboarding/onboardingReplay'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import type { SharedWorkflowUrlLoadStatus } from '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'
import { useNewUserService } from '@/services/useNewUserService'
import { useAuthStore } from '@/stores/authStore'
import { useCommandStore } from '@/stores/commandStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

const STARTUP_DECISION_TIMEOUT_MS = 60_000

type FirstRunScreenState =
  | { phase: 'released' }
  | { phase: 'visible' }
  | { phase: 'handoff'; handoffs: ReadonlySet<symbol> }

type FirstRunScreenEvent =
  | { type: 'shown' }
  | { type: 'dismissed' }
  | { type: 'released' }
  | { type: 'handoffStarted'; ownership: symbol }
  | { type: 'handoffFinished'; ownership: symbol }

function finishFirstRunHandoff(
  state: FirstRunScreenState,
  ownership: symbol
): FirstRunScreenState {
  if (state.phase !== 'handoff' || !state.handoffs.has(ownership)) return state
  const handoffs = new Set(state.handoffs)
  handoffs.delete(ownership)
  return handoffs.size === 0
    ? { phase: 'released' }
    : { phase: 'handoff', handoffs }
}

function transitionFirstRunScreen(
  state: FirstRunScreenState,
  event: FirstRunScreenEvent
): FirstRunScreenState {
  switch (event.type) {
    case 'shown':
      return { phase: 'visible' }
    case 'dismissed':
      return state.phase === 'visible' ? { phase: 'released' } : state
    case 'released':
      return { phase: 'released' }
    case 'handoffStarted':
      return {
        phase: 'handoff',
        handoffs: new Set([
          ...(state.phase === 'handoff' ? state.handoffs : []),
          event.ownership
        ])
      }
    case 'handoffFinished':
      return finishFirstRunHandoff(state, event.ownership)
  }
}

export const useFirstRunEntry = createSharedComposable(() => {
  const authStore = useAuthStore()
  const settingStore = useSettingStore()
  const firstRunScreen = ref<FirstRunScreenState>({ phase: 'released' })
  const startupDecided = ref(false)
  let authGeneration = 0
  const isDesktopWidth =
    useBreakpoints(breakpointsTailwind).greaterOrEqual('md')

  const gettingStartedVisible = computed(
    () => firstRunScreen.value.phase === 'visible'
  )
  const firstRunHoldsScreen = computed(
    () => firstRunScreen.value.phase !== 'released'
  )

  function dispatchFirstRunScreen(event: FirstRunScreenEvent): void {
    firstRunScreen.value = transitionFirstRunScreen(firstRunScreen.value, event)
  }

  watch(
    () => authStore.userId,
    (userId, previousUserId) => {
      if (previousUserId === undefined || userId === previousUserId) return
      authGeneration++
      dispatchFirstRunScreen({ type: 'released' })
      void useFirstRunTourController()
        .cancelPendingStart()
        .catch((error) =>
          reportError(error, {
            surface: 'platform',
            errorType: 'failure_restoring_first_run_renderer_setting',
            level: 'warning'
          })
        )
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
      dispatchFirstRunScreen({ type: 'shown' })
      consumeFirstRunReplayRequest(authStore.userId)
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
      const started = await useFirstRunTourController().beginTour(
        shareLoaded ? undefined : templateId,
        () => authStore.userId !== ownerId
      )
      if (!started) return
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
        surface: 'platform',
        errorType: 'failure_writing_tutorial_completed_setting',
        level: 'warning'
      })
    }
  }

  async function dismissGettingStarted() {
    dispatchFirstRunScreen({ type: 'dismissed' })
    await markTutorialCompleted()
  }

  async function dismissIntoFirstRunTour(templateId: string): Promise<void> {
    const ownerId = authStore.userId
    const ownerGeneration = authGeneration
    const ownership = Symbol('first-run-tour-handoff')
    dispatchFirstRunScreen({ type: 'handoffStarted', ownership })
    try {
      await dismissGettingStarted()
      if (authStore.userId !== ownerId || authGeneration !== ownerGeneration)
        return
      await useFirstRunTourController().beginTour(
        templateId,
        () => authStore.userId !== ownerId || authGeneration !== ownerGeneration
      )
    } finally {
      dispatchFirstRunScreen({ type: 'handoffFinished', ownership })
    }
  }

  return {
    gettingStartedVisible,
    firstRunHoldsScreen,
    whenStartupDecided,
    handleStartupOutcome,
    handleUrlWorkflow,
    dismissGettingStarted,
    dismissIntoFirstRunTour
  }
})
