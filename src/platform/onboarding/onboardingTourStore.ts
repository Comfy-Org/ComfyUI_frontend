import { defineStore } from 'pinia'
import { computed, readonly, shallowRef, watch } from 'vue'

import { t, te } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import type {
  OnboardingTourNotStartedReason,
  OnboardingTourSkipReason,
  OnboardingTourStepStage
} from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { targetMounted, waitForTarget } from './coachmarkRegistry'
import {
  ENTRY_PATHS,
  TOUR_SEEN_SETTING,
  registerTourHolds,
  resolveSteps,
  tourDefinition,
  tourHolds
} from './onboardingTours'
import type { CoachStep, EntryPath, TourDefinition } from './onboardingTours'
import { IDLE, isRunning, reduceTour, shownIdx } from './tourState'
import type { RunId, TourEvent, TourState } from './tourState'
import { useTourTriggers } from './useTourTriggers'

const DEFER_TIMEOUT_MS = 8000

/**
 * How the last run of a tour ended. Whatever follows a tour has to know which
 * ending it is following: "a tour ran" cannot tell a tour walked to the end
 * apart from one the user waved away on step 1, or one a missing target tore
 * down.
 */
export type TourEnding =
  | { tour: EntryPath; outcome: 'completed' }
  | {
      tour: EntryPath
      outcome: 'skipped'
      skipReason: OnboardingTourSkipReason
    }

/** Empty when a runtime resolver fails, so one bad graph costs only its own tour. */
async function resolveDefinition(
  definition: TourDefinition
): Promise<{ steps: CoachStep[]; reason?: OnboardingTourNotStartedReason }> {
  if (Array.isArray(definition)) return { steps: definition }
  try {
    const resolution = await definition()
    return Array.isArray(resolution) ? { steps: resolution } : resolution
  } catch (error) {
    console.error('coachmark tour definition failed', error)
    return { steps: [], reason: 'resolver_failed' }
  }
}

/**
 * The tour state machine: which tour starts and when, which steps run, and the
 * advance/skip/complete lifecycle.
 */
export const useOnboardingTourStore = defineStore('onboardingTour', () => {
  const settingStore = useSettingStore()
  const telemetry = useTelemetry()

  const state = shallowRef<TourState>(IDLE)
  const lastEnding = shallowRef<TourEnding | null>(null)
  let stepController: AbortController | null = null
  let lastRun = 0

  function nextRun(): RunId {
    return ++lastRun as RunId
  }

  /** The only writer of `state`. Returns false when the reducer refused. */
  function dispatch(event: TourEvent): boolean {
    const before = state.value
    state.value = reduceTour(before, event)
    return state.value !== before
  }

  function currentRun(): RunId | null {
    return state.value.phase === 'idle' ? null : state.value.run
  }

  const steps = computed<CoachStep[]>(() =>
    isRunning(state.value) ? state.value.steps : []
  )
  const activeTour = computed<EntryPath | null>(() =>
    state.value.phase === 'idle' ? null : state.value.tour
  )
  const waitingForTarget = computed(() => state.value.phase === 'waiting')
  const stepSettled = computed(() => state.value.phase === 'showing')

  const stepIdx = computed(() => shownIdx(state.value))

  const step = computed<CoachStep | null>(() =>
    stepIdx.value === null ? null : (steps.value[stepIdx.value] ?? null)
  )
  const isLast = computed(() => stepIdx.value === steps.value.length - 1)

  const countedSteps = computed<CoachStep[]>(() =>
    steps.value.filter((s) => s.kind !== 'landing')
  )
  const countedStepsTotal = computed(() => countedSteps.value.length)
  const countedStepIdx = computed(() => {
    const s = step.value
    return s ? countedSteps.value.indexOf(s) : 0
  })
  const previousStep = computed<CoachStep | null>(() =>
    stepIdx.value === null ? null : (steps.value[stepIdx.value - 1] ?? null)
  )

  const canGoBack = computed(() => {
    const previous = previousStep.value
    if (countedStepIdx.value <= 0) return false
    return previous?.kind !== 'spotlight' || previous.selfAdvancing !== true
  })

  /** What telemetry reports, captured before a transition clears it. */
  function snapshot() {
    return { tour: activeTour.value, counted: countedSteps.value }
  }

  function trackTour(
    stage: OnboardingTourStepStage,
    skipReason?: OnboardingTourSkipReason,
    reported: CoachStep | null = step.value,
    { tour, counted } = snapshot()
  ) {
    if (!tour) return
    const reportedIdx = reported ? counted.indexOf(reported) : -1
    telemetry?.trackOnboardingTour(stage, {
      tour,
      step_count: counted.length,
      ...(stage !== 'started' &&
        reportedIdx >= 0 && {
          step_number: reportedIdx + 1,
          coach_id:
            reported?.kind === 'spotlight' ? reported.coachId : undefined
        }),
      ...(skipReason && { skip_reason: skipReason })
    })
  }

  function stepKey(suffix: string) {
    return `onboardingCoachmarks.${activeTour.value}.${step.value?.name}.${suffix}`
  }

  const title = computed(() => (step.value ? t(stepKey('title')) : ''))
  const body = computed(() => (step.value ? t(stepKey('body')) : ''))

  // A step overrides the generic button labels by declaring `primary`/`skip`
  // entries under its translation keys.
  const primaryLabel = computed(() => {
    if (step.value && te(stepKey('primary'))) return t(stepKey('primary'))
    return isLast.value
      ? t('onboardingCoachmarks.done')
      : t('onboardingCoachmarks.next')
  })

  const skipLabel = computed(() =>
    step.value && te(stepKey('skip'))
      ? t(stepKey('skip'))
      : t('onboardingCoachmarks.skip')
  )

  const backLabel = computed(() => t('onboardingCoachmarks.back'))

  async function showStep(idx: number) {
    const current = state.value
    if (!isRunning(current)) return
    const nextStep = current.steps[idx]
    if (!nextStep) return

    stepController?.abort()
    const controller = new AbortController()
    stepController = controller
    const { signal } = controller

    const run = current.run
    const superseded = () =>
      run !== currentRun() || stepController !== controller
    const fromIdx = shownIdx(current)
    if (nextStep.kind === 'spotlight' && nextStep.openSidebarTab)
      openSidebarTab(nextStep.openSidebarTab)

    if (
      nextStep.kind === 'spotlight' &&
      nextStep.deferTarget &&
      nextStep.coachId &&
      !targetMounted(nextStep.coachId)
    ) {
      if (!dispatch({ type: 'targetAwaited', run, fromIdx })) return
      const found = await waitForTarget(
        nextStep.coachId,
        signal,
        DEFER_TIMEOUT_MS
      )
      // The step moved on without us; only a timeout ends it here.
      if (superseded()) return
      if (!found) {
        abandonStep(nextStep)
        return
      }
    }

    if (!dispatch({ type: 'stepEntering', run, toIdx: idx })) return
    if (nextStep.onEnter) {
      try {
        await nextStep.onEnter(signal)
      } catch (error) {
        if (superseded()) return
        console.error('coachmark onEnter failed', error)
        abandonStep(nextStep)
        return
      }
      if (superseded()) return
    }
    if (!dispatch({ type: 'stepShown', run, idx })) return
    trackTour('step_shown')
  }

  /**
   * Ends the tour on a step it could not present, without the seen-flag so the
   * user is offered it again rather than losing it to a bad moment.
   */
  function abandonStep(step: CoachStep) {
    finish('skipped', {
      markSeen: false,
      skipReason: 'target_timeout',
      reported: step
    })
    useToastStore().add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('onboardingCoachmarks.loadError')
    })
  }
  const lostTarget = computed(() => {
    if (state.value.phase !== 'showing') return null
    const shown = step.value
    if (shown?.kind !== 'spotlight') return null
    return shown.coachId && !targetMounted(shown.coachId) ? shown : null
  })

  watch(lostTarget, (lost) => {
    if (lost) abandonStep(lost)
  })

  function openSidebarTab(tabId: string) {
    const sidebar = useSidebarTabStore()
    if (sidebar.activeSidebarTabId !== tabId) sidebar.toggleSidebarTab(tabId)
  }

  function next() {
    if (waitingForTarget.value) return
    if (isLast.value) {
      finish('completed')
      return
    }
    if (stepIdx.value !== null) void showStep(stepIdx.value + 1)
  }

  function back() {
    if (canGoBack.value && stepIdx.value !== null)
      void showStep(stepIdx.value - 1)
  }

  function skip() {
    finish('skipped')
  }

  /**
   * Ends the tour without marking it seen: something outside it barred the way,
   * so the user has not had their tour yet and is offered it again.
   */
  function postpone() {
    finish('skipped', { markSeen: false, skipReason: 'postponed' })
  }

  function finish(
    outcome: 'completed' | 'skipped',
    {
      markSeen = true,
      skipReason = 'user',
      reported
    }: {
      markSeen?: boolean
      skipReason?: OnboardingTourSkipReason
      reported?: CoachStep
    } = {}
  ) {
    const run = currentRun()
    if (run === null) return
    const ending = snapshot()
    const reportedStep = reported ?? step.value

    if (!dispatch({ type: 'ended', run })) return

    if (ending.tour)
      lastEnding.value =
        outcome === 'skipped'
          ? { tour: ending.tour, outcome, skipReason }
          : { tour: ending.tour, outcome }
    trackTour(
      outcome,
      outcome === 'skipped' ? skipReason : undefined,
      reportedStep,
      ending
    )
    stepController?.abort()
    if (markSeen && ending.tour) markTourSeen(ending.tour)
  }

  for (const [entryPath, trigger] of useTourTriggers()) {
    registerTourHolds(entryPath, trigger.holds)
    watch(
      trigger.autoOpen,
      (visible) => {
        if (visible) void startTour(entryPath)
      },
      { immediate: true }
    )
  }

  // One rule for every tour: lose the context its steps point at, lose the tour.
  for (const entryPath of ENTRY_PATHS) {
    watch(
      () => tourHolds(entryPath),
      (holding) => {
        if (!holding && activeTour.value === entryPath)
          finish('skipped', { markSeen: false, skipReason: 'trigger_lost' })
      }
    )
  }

  function hasSeenTour(entryPath: EntryPath): boolean {
    return settingStore.get(TOUR_SEEN_SETTING).includes(entryPath)
  }

  function markTourSeen(entryPath: EntryPath) {
    const seen = settingStore.get(TOUR_SEEN_SETTING)
    if (seen.includes(entryPath)) return
    void settingStore.set(TOUR_SEEN_SETTING, [...seen, entryPath])
  }

  async function begin(entryPath: EntryPath): Promise<boolean> {
    const definition = tourDefinition(entryPath)
    if (!definition || !tourHolds(entryPath)) return false
    const run = nextRun()
    if (!dispatch({ type: 'requested', tour: entryPath, run })) return false
    // A new run has no ending yet; the one before it must not speak for it.
    lastEnding.value = null
    const built = await resolveDefinition(definition)
    const resolved = resolveSteps(built.steps, targetMounted)
    if (!resolved.length) {
      dispatch({ type: 'resolvedEmpty', run })
      reportNotStarted(entryPath, built.reason ?? 'no_steps')
      return false
    }
    // Refused when this run ended while its definition was still resolving.
    if (!dispatch({ type: 'resolved', run, steps: resolved })) return false
    trackTour('started')
    void showStep(0)
    return true
  }

  const reportedNotStarted = new Set<EntryPath>()
  function reportNotStarted(
    entryPath: EntryPath,
    reason: OnboardingTourNotStartedReason
  ) {
    if (reportedNotStarted.has(entryPath)) return
    reportedNotStarted.add(entryPath)
    telemetry?.trackOnboardingTour('not_started', {
      tour: entryPath,
      step_count: 0,
      not_started_reason: reason
    })
  }

  /** Starts an unseen tour; false when nothing started. */
  async function startTour(entryPath: EntryPath): Promise<boolean> {
    if (hasSeenTour(entryPath)) {
      reportNotStarted(entryPath, 'already_seen')
      return false
    }
    return begin(entryPath)
  }

  function replayTour(entryPath: EntryPath) {
    void begin(entryPath)
  }

  return {
    activeTour: readonly(activeTour),
    lastEnding: readonly(lastEnding),
    step,
    isLast,
    canGoBack,
    title,
    body,
    primaryLabel,
    skipLabel,
    backLabel,
    countedStepIdx,
    countedStepsTotal,
    waitingForTarget,
    stepSettled,
    startTour,
    replayTour,
    next,
    back,
    skip,
    postpone
  }
})
