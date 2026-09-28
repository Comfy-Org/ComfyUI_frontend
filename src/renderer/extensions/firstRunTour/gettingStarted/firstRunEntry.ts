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
import { reportError } from '@/platform/telemetry/reportError'
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
  const activeTourHandoffs = ref<ReadonlySet<symbol>>(new Set())
  let authGeneration = 0
  const isDesktopWidth =
    useBreakpoints(breakpointsTailwind).greaterOrEqual('md')

  /** Keeps ownership through the gap between dismissal and tour activation. */
  const firstRunHoldsScreen = computed(
    () => gettingStartedVisible.value || activeTourHandoffs.value.size > 0
  )

  watch(
    () => authStore.userId,
    (userId, previousUserId) => {
      if (previousUserId === undefined || userId === previousUserId) return
      authGeneration++
      gettingStartedVisible.value = false
      activeTourHandoffs.value = new Set()
      void useFirstRunTourController()
        .cancelPendingStart()
        .catch((error) =>
          reportError(error, {
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
      gettingStartedVisible.value = true
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
        errorType: 'failure_writing_tutorial_completed_setting',
        level: 'warning'
      })
    }
  }

  async function dismissGettingStarted() {
    gettingStartedVisible.value = false
    await markTutorialCompleted()
  }

  /** Dismisses into a tour without exposing the transition as a clear screen. */
  async function dismissIntoFirstRunTour(templateId: string): Promise<void> {
    const ownerId = authStore.userId
    const ownerGeneration = authGeneration
    const ownership = Symbol('first-run-tour-handoff')
    activeTourHandoffs.value = new Set([...activeTourHandoffs.value, ownership])
    try {
      await dismissGettingStarted()
      if (authStore.userId !== ownerId || authGeneration !== ownerGeneration)
        return
      await useFirstRunTourController().beginTour(
        templateId,
        () => authStore.userId !== ownerId || authGeneration !== ownerGeneration
      )
    } finally {
      if (activeTourHandoffs.value.has(ownership)) {
        const remainingHandoffs = new Set(activeTourHandoffs.value)
        remainingHandoffs.delete(ownership)
        activeTourHandoffs.value = remainingHandoffs
      }
    }
  }

  return {
    gettingStartedVisible: readonly(gettingStartedVisible),
    firstRunHoldsScreen,
    whenStartupDecided,
    handleStartupOutcome,
    handleUrlWorkflow,
    dismissGettingStarted,
    dismissIntoFirstRunTour
  }
})
