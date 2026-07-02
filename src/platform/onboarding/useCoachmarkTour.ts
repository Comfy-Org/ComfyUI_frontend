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
 * The tour state machine: which tour starts and when, which steps run, and the
 * advance/skip/complete lifecycle.
 */
export function useCoachmarkTour() {
  const { t, te } = useI18n()
  const settingStore = useSettingStore()
  const telemetry = useTelemetry()

  const steps = ref<CoachStep[]>([])
  const stepIdx = ref(0)
  const suspendFocusGuard = ref(false)
  const activeTour = ref<EntryPath | null>(null)
  let stepController: AbortController | null = null

  const step = computed<CoachStep | null>(
    () => steps.value[stepIdx.value] ?? null
  )
  const isLast = computed(() => stepIdx.value === steps.value.length - 1)

  const countedSteps = computed(() => steps.value.filter((s) => !s.landing))
  const countedStepIdx = computed(() => {
    const s = step.value
    return s ? countedSteps.value.indexOf(s) : 0
  })

  function trackTour(stage: OnboardingTourStage) {
    const tour = activeTour.value
    if (!tour) return
    const coachId = step.value?.coachId
    telemetry?.trackOnboardingTour(stage, {
      tour,
      step_count: countedSteps.value.length,
      ...(stage !== 'started' &&
        countedStepIdx.value >= 0 && {
          step_number: countedStepIdx.value + 1,
          coach_id: Array.isArray(coachId) ? coachId.join('+') : coachId
        })
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
      // Point at the timed-out step so telemetry reports it, and skip without
      // the seen-flag so a missed target isn't permanent.
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
    if (markSeen && activeTour.value) markTourSeen(activeTour.value)
    activeTour.value = null
  }

  onBeforeUnmount(() => {
    stepController?.abort()
  })

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
    if (steps.value.length) return
    if (!force && hasSeenTour(entryPath)) return
    const resolved = resolveSteps(TOURS[entryPath], targetMounted)
    if (!resolved.length) return
    steps.value = resolved
    activeTour.value = entryPath
    trackTour('started')
    void showStep(0)
  }

  onTourRequested((tour) => startTour(tour, true))

  return {
    step,
    isLast,
    title,
    body,
    primaryLabel,
    skipLabel,
    countedStepIdx,
    countedSteps,
    suspendFocusGuard,
    next,
    end
  }
}
