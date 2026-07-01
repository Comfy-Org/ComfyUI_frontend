import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import type { OnboardingTourStage } from '@/platform/telemetry/types'

import { onTourRequested } from './coachmarkController'
import { targetMounted, waitForTarget } from './coachmarkRegistry'
import { TOURS, resolveSteps } from './onboardingTours'
import type { CoachStep, EntryPath } from './onboardingTours'
import { useTourTriggers } from './useTourTriggers'

const SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'
const DEFER_TIMEOUT_MS = 8000

/**
 * The onboarding tour state machine: decides which tour starts and when (auto-open
 * triggers, explicit requests), resolves which steps run, and drives the
 * advance/skip/complete lifecycle. TourSpotlight owns the spotlight, focus trap
 * and modal stacking for whichever step is shown.
 */
export function useCoachmarkTour() {
  const { t } = useI18n()
  const settingStore = useSettingStore()
  const telemetry = useTelemetry()

  const steps = ref<CoachStep[]>([])
  const stepIdx = ref(0)
  // Lets a deferred target autofocus without the spotlight pulling focus back.
  const suspendFocusGuard = ref(false)
  let activeTour: EntryPath | null = null
  let stepController: AbortController | null = null

  const step = computed<CoachStep | null>(
    () => steps.value[stepIdx.value] ?? null
  )
  const isLast = computed(() => stepIdx.value === steps.value.length - 1)

  // Landing steps aren't numbered, so the indicator counts only spotlight steps.
  const countedSteps = computed(() => steps.value.filter((s) => !s.landing))
  const countedStepIdx = computed(() => {
    const s = step.value
    return s ? countedSteps.value.indexOf(s) : 0
  })

  function trackTour(stage: OnboardingTourStage) {
    if (!activeTour) return
    const coachId = step.value?.coachId
    telemetry?.trackOnboardingTour(stage, {
      tour: activeTour,
      step_count: steps.value.length,
      ...(stage !== 'started' && {
        step_index: stepIdx.value,
        coach_id: Array.isArray(coachId) ? coachId.join('+') : coachId
      })
    })
  }

  const primaryLabel = computed(() => {
    const key = step.value?.primaryLabelKey
    if (key) return t(key)
    return isLast.value
      ? t('onboardingCoachmarks.done')
      : t('onboardingCoachmarks.next')
  })

  const skipLabel = computed(() =>
    t(step.value?.skipLabelKey ?? 'onboardingCoachmarks.skip')
  )

  async function showStep(idx: number) {
    const nextStep = steps.value[idx]
    if (!nextStep) return
    stepController?.abort()
    const controller = new AbortController()
    stepController = controller
    const { signal } = controller
    suspendFocusGuard.value = false
    if (
      nextStep.deferTarget &&
      nextStep.coachId &&
      !targetMounted(nextStep.coachId)
    ) {
      suspendFocusGuard.value = true
      const found = await waitForTarget(
        nextStep.coachId,
        signal,
        DEFER_TIMEOUT_MS
      )
      if (signal.aborted) return
      suspendFocusGuard.value = false
      // Abandon without the seen-flag, so a missed target isn't permanent.
      // Point at the timed-out step first so telemetry reports its coachmark.
      if (!found) {
        stepIdx.value = idx
        end('skipped', false)
        return
      }
    }
    stepIdx.value = idx
    trackTour('step_shown')
  }

  function next() {
    if (isLast.value) {
      end('completed')
      return
    }
    void showStep(stepIdx.value + 1)
  }

  function end(outcome: 'completed' | 'skipped', markSeen = true) {
    trackTour(outcome)
    stepController?.abort()
    suspendFocusGuard.value = false
    steps.value = []
    stepIdx.value = 0
    if (markSeen && activeTour) markTourSeen(activeTour)
    activeTour = null
  }

  onBeforeUnmount(() => {
    stepController?.abort()
  })

  // Each tour declares its own activation condition; the engine just watches them.
  for (const [entryPath, active] of useTourTriggers()) {
    watch(
      active,
      (visible) => {
        if (visible) startTour(entryPath)
      },
      { immediate: true }
    )
  }

  function hasSeenTour(entryPath: EntryPath): boolean {
    return settingStore.get(SEEN_SETTING).includes(entryPath)
  }

  function markTourSeen(entryPath: EntryPath) {
    const seen = settingStore.get(SEEN_SETTING)
    if (seen.includes(entryPath)) return
    void settingStore.set(SEEN_SETTING, [...seen, entryPath])
  }

  function startTour(entryPath: EntryPath, force = false) {
    // startTour is synchronous, so a concurrent trigger sees the first's steps.
    if (steps.value.length) return
    if (!force && hasSeenTour(entryPath)) return
    const resolved = resolveSteps(TOURS[entryPath], targetMounted)
    if (!resolved.length) return
    steps.value = resolved
    activeTour = entryPath
    trackTour('started')
    void showStep(0)
  }

  // An explicit request (e.g. info button) replays the tour past its seen-flag.
  onTourRequested((tour) => startTour(tour, true))

  return {
    step,
    isLast,
    primaryLabel,
    skipLabel,
    countedStepIdx,
    countedSteps,
    suspendFocusGuard,
    next,
    end
  }
}
