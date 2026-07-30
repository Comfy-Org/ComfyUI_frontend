import { defineStore } from 'pinia'
import { computed, readonly, shallowRef, watch } from 'vue'

import { t, te } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import type {
  OnboardingTourSkipReason,
  OnboardingTourStage
} from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { targetMounted, waitForTarget } from './coachmarkRegistry'
import {
  TOUR_SEEN_SETTING,
  resolveSteps,
  tourDefinition
} from './onboardingTours'
import type { CoachStep, EntryPath } from './onboardingTours'
import { useTourTriggers } from './useTourTriggers'

const DEFER_TIMEOUT_MS = 8000

const IDLE = { phase: 'idle' } as const

/** `entering` is separate from `showing` because `onEnter` runs between them. */
type TourState =
  | typeof IDLE
  | { phase: 'resolving'; tour: EntryPath }
  | {
      phase: 'waiting'
      tour: EntryPath
      steps: CoachStep[]
      fromIdx: number | null
    }
  | {
      phase: 'entering'
      tour: EntryPath
      steps: CoachStep[]
      fromIdx: number | null
      toIdx: number
    }
  | { phase: 'showing'; tour: EntryPath; steps: CoachStep[]; idx: number }

type RunningState = Extract<
  TourState,
  { phase: 'waiting' | 'entering' | 'showing' }
>

function isRunning(state: TourState): state is RunningState {
  return (
    state.phase === 'waiting' ||
    state.phase === 'entering' ||
    state.phase === 'showing'
  )
}

/** A card already up holds its step while the next enters, so it travels. */
function shownIdx(state: TourState): number | null {
  if (state.phase === 'showing') return state.idx
  if (state.phase === 'entering' || state.phase === 'waiting')
    return state.fromIdx
  return null
}

/**
 * The tour state machine: which tour starts and when, which steps run, and the
 * advance/skip/complete lifecycle.
 */
export const useOnboardingTourStore = defineStore('onboardingTour', () => {
  const settingStore = useSettingStore()
  const telemetry = useTelemetry()

  const state = shallowRef<TourState>(IDLE)
  let stepController: AbortController | null = null

  const steps = computed<CoachStep[]>(() =>
    isRunning(state.value) ? state.value.steps : []
  )
  const activeTour = computed<EntryPath | null>(() =>
    state.value.phase === 'idle' ? null : state.value.tour
  )
  const waitingForTarget = computed(() => state.value.phase === 'waiting')

  const stepIdx = computed(() => shownIdx(state.value))

  const step = computed<CoachStep | null>(() =>
    stepIdx.value === null ? null : (steps.value[stepIdx.value] ?? null)
  )
  const isLast = computed(() => stepIdx.value === steps.value.length - 1)

  const countedSteps = computed(() => steps.value.filter((s) => !s.landing))
  const countedStepsTotal = computed(() => countedSteps.value.length)
  const countedStepIdx = computed(() => {
    const s = step.value
    return s ? countedSteps.value.indexOf(s) : 0
  })
  const previousStep = computed<CoachStep | null>(() =>
    stepIdx.value === null ? null : (steps.value[stepIdx.value - 1] ?? null)
  )

  const canGoBack = computed(
    () => countedStepIdx.value > 0 && previousStep.value?.selfAdvancing !== true
  )

  function trackTour(
    stage: OnboardingTourStage,
    skipReason?: OnboardingTourSkipReason,
    reported: CoachStep | null = step.value
  ) {
    const tour = activeTour.value
    if (!tour) return
    const reportedIdx = reported ? countedSteps.value.indexOf(reported) : -1
    telemetry?.trackOnboardingTour(stage, {
      tour,
      step_count: countedSteps.value.length,
      ...(stage !== 'started' &&
        reportedIdx >= 0 && {
          step_number: reportedIdx + 1,
          coach_id: reported?.coachId
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

    const fromIdx = shownIdx(current)
    const { steps: running, tour } = current
    if (nextStep.openSidebarTab) openSidebarTab(nextStep.openSidebarTab)

    if (
      nextStep.deferTarget &&
      nextStep.coachId &&
      !targetMounted(nextStep.coachId)
    ) {
      state.value = { phase: 'waiting', tour, steps: running, fromIdx }
      const found = await waitForTarget(
        nextStep.coachId,
        signal,
        DEFER_TIMEOUT_MS
      )
      // An abort has already moved the tour on; only a timeout ends it here.
      if (signal.aborted) return
      if (!found) {
        abandonStep(nextStep)
        return
      }
    }

    state.value = {
      phase: 'entering',
      tour,
      steps: running,
      fromIdx,
      toIdx: idx
    }
    if (nextStep.onEnter) {
      try {
        await nextStep.onEnter(signal)
      } catch (error) {
        if (signal.aborted) return
        console.error('coachmark onEnter failed', error)
        abandonStep(nextStep)
        return
      }
      if (signal.aborted) return
    }
    state.value = { phase: 'showing', tour, steps: running, idx }
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
    return shown?.coachId && !targetMounted(shown.coachId) ? shown : null
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

  /** Ends the tour as completed, for consumers whose last step self-completes. */
  function complete() {
    finish('completed')
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
    const tour = activeTour.value
    trackTour(
      outcome,
      outcome === 'skipped' ? skipReason : undefined,
      reported ?? step.value
    )
    stepController?.abort()
    if (markSeen && tour) markTourSeen(tour)
    state.value = IDLE
  }

  for (const [entryPath, trigger] of useTourTriggers()) {
    watch(
      trigger.autoOpen,
      (visible) => {
        if (visible) void startTour(entryPath)
      },
      { immediate: true }
    )
    watch(trigger.holds, (holding) => {
      if (!holding && activeTour.value === entryPath)
        finish('skipped', { markSeen: false, skipReason: 'trigger_lost' })
    })
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
    if (state.value.phase !== 'idle') return false
    const definition = tourDefinition(entryPath)
    if (!definition) return false
    state.value = { phase: 'resolving', tour: entryPath }
    const built = Array.isArray(definition) ? definition : await definition()
    const resolved = resolveSteps(built, targetMounted)
    if (!resolved.length) {
      state.value = IDLE
      return false
    }
    state.value = {
      phase: 'entering',
      tour: entryPath,
      steps: resolved,
      fromIdx: null,
      toIdx: 0
    }
    trackTour('started')
    void showStep(0)
    return true
  }

  /** Starts an unseen tour; false when nothing started. */
  async function startTour(entryPath: EntryPath): Promise<boolean> {
    if (hasSeenTour(entryPath)) return false
    return begin(entryPath)
  }

  function replayTour(entryPath: EntryPath) {
    void begin(entryPath)
  }

  return {
    activeTour: readonly(activeTour),
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
    startTour,
    replayTour,
    next,
    back,
    skip,
    complete,
    postpone
  }
})
