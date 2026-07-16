import { defineStore } from 'pinia'
import { computed, readonly, ref, shallowRef, watch } from 'vue'

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
import { TOURS, TOUR_SEEN_SETTING, resolveSteps } from './onboardingTours'
import type { CoachStep, EntryPath } from './onboardingTours'
import { useTourTriggers } from './useTourTriggers'

const DEFER_TIMEOUT_MS = 8000

/**
 * The tour state machine: which tour starts and when, which steps run, and the
 * advance/skip/complete lifecycle.
 */
export const useOnboardingTourStore = defineStore('onboardingTour', () => {
  const settingStore = useSettingStore()
  const telemetry = useTelemetry()

  const steps = shallowRef<CoachStep[]>([])
  const stepIdx = ref(0)
  const waitingForTarget = ref(false)
  const activeTour = ref<EntryPath | null>(null)
  let stepController: AbortController | null = null

  const step = computed<CoachStep | null>(
    () => steps.value[stepIdx.value] ?? null
  )
  const isLast = computed(() => stepIdx.value === steps.value.length - 1)

  const countedSteps = computed(() => steps.value.filter((s) => !s.landing))
  const countedStepsTotal = computed(() => countedSteps.value.length)
  const countedStepIdx = computed(() => {
    const s = step.value
    return s ? countedSteps.value.indexOf(s) : 0
  })
  // Back navigates the numbered steps only — never into the landing.
  const canGoBack = computed(() => countedStepIdx.value > 0)

  function trackTour(
    stage: OnboardingTourStage,
    skipReason?: OnboardingTourSkipReason
  ) {
    const tour = activeTour.value
    // Definition-driven tours (firstRun) aren't in TOURS and report their own telemetry.
    if (!tour || !TOURS[tour]) return
    telemetry?.trackOnboardingTour(stage, {
      tour,
      step_count: countedSteps.value.length,
      ...(stage !== 'started' &&
        countedStepIdx.value >= 0 && {
          step_number: countedStepIdx.value + 1,
          coach_id: step.value?.coachId
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
    const nextStep = steps.value[idx]
    if (!nextStep) return
    stepController?.abort()
    const controller = new AbortController()
    stepController = controller
    const { signal } = controller
    waitingForTarget.value = false
    if (nextStep.openSidebarTab) openSidebarTab(nextStep.openSidebarTab)
    if (
      nextStep.deferTarget &&
      nextStep.coachId &&
      !targetMounted(nextStep.coachId)
    ) {
      waitingForTarget.value = true
      const found = await waitForTarget(
        nextStep.coachId,
        signal,
        DEFER_TIMEOUT_MS
      )
      if (signal.aborted) {
        if (stepController === controller) waitingForTarget.value = false
        return
      }
      waitingForTarget.value = false
      // Point at the timed-out step so telemetry reports it, and skip without
      // the seen-flag so a missed target isn't permanent.
      if (!found) {
        stepIdx.value = idx
        finish('skipped', { markSeen: false, skipReason: 'target_timeout' })
        useToastStore().add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('onboardingCoachmarks.loadError')
        })
        return
      }
    }
    stepIdx.value = idx
    trackTour('step_shown')
  }

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
    void showStep(stepIdx.value + 1)
  }

  function back() {
    if (canGoBack.value) void showStep(stepIdx.value - 1)
  }

  function skip() {
    finish('skipped')
  }

  function finish(
    outcome: 'completed' | 'skipped',
    {
      markSeen = true,
      skipReason = 'user'
    }: { markSeen?: boolean; skipReason?: OnboardingTourSkipReason } = {}
  ) {
    trackTour(outcome, outcome === 'skipped' ? skipReason : undefined)
    stepController?.abort()
    waitingForTarget.value = false
    steps.value = []
    stepIdx.value = 0
    if (markSeen && activeTour.value) markTourSeen(activeTour.value)
    activeTour.value = null
  }

  for (const [entryPath, trigger] of useTourTriggers()) {
    watch(
      trigger.autoOpen,
      (visible) => {
        if (visible) startTour(entryPath)
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

  function startTour(
    entryPath: EntryPath,
    {
      force = false,
      definition
    }: { force?: boolean; definition?: CoachStep[] } = {}
  ) {
    if (steps.value.length) return
    if (!force && hasSeenTour(entryPath)) return
    const def = definition ?? TOURS[entryPath]
    if (!def) return
    const resolved = resolveSteps(def, targetMounted)
    if (!resolved.length) return
    steps.value = resolved
    activeTour.value = entryPath
    trackTour('started')
    void showStep(0)
  }

  function replayTour(entryPath: EntryPath) {
    startTour(entryPath, { force: true })
  }

  return {
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
    activeTour: readonly(activeTour),
    startTour,
    replayTour,
    next,
    back,
    skip
  }
})
