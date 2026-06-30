import { ZIndex } from '@primeuix/utils/zindex'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { MODAL_Z_BASE, MODAL_Z_KEY } from '@/components/dialog/vRekaZIndex'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'

import { useCoachmarkController } from './coachmarkController'
import { TOURS, resolveSteps } from './onboardingTours'
import type { CoachStep, EntryPath } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'
import { useFocusTrap } from './useFocusTrap'

const SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'
const START_DELAY_MS = 800
const DEFER_TIMEOUT_MS = 8000
// How long a user can stall on an interaction step before the outline pulses.
const PULSE_IDLE_MS = 4000

type TourStage = 'started' | 'step_shown' | 'completed' | 'skipped'

// `?coach=<path>` forces that tour; any non-path value forces the auto-detected one.
type ForcedTour = EntryPath | 'any'

/**
 * The onboarding tour state machine: resolves which steps run, drives the
 * advance/skip/complete lifecycle, and keeps the spotlight target, focus trap
 * and modal stacking in step. TourOverlay owns only rendering and placement.
 */
export function useCoachmarkTour(refs: {
  cardRef: Ref<HTMLElement | null>
  overlayRef: Ref<HTMLElement | null>
}) {
  const { cardRef, overlayRef } = refs
  const { t } = useI18n()

  const settingStore = useSettingStore()
  const telemetry = useTelemetry()
  const steps = ref<CoachStep[]>([])
  const stepIdx = ref(0)
  const pulsing = ref(false)
  let activeTour: EntryPath | null = null
  // Set synchronously so a second trigger can't slip past the steps guard mid-resolution.
  let starting = false
  let startTimer: ReturnType<typeof setTimeout> | undefined
  let pulseTimer: ReturnType<typeof setTimeout> | undefined
  // Cancels the step's in-flight async work when it advances, the tour ends, or unmounts.
  let stepController: AbortController | null = null
  // Suspends the focusin guard while a deferred target autofocuses, so we don't fight it.
  let awaitingDeferredTarget = false

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

  const {
    targetRect,
    targetEl,
    candidateEls,
    measure,
    settle,
    targetMounted,
    waitForTarget
  } = useCoachmarkTarget(step)

  // The landing Dialog owns its own focus trap, so ours runs only for spotlight steps.
  const focusTrap = useFocusTrap({
    cardRef,
    getTarget: () => targetEl.value,
    isActive: () => !!step.value && !step.value.landing,
    isSuspended: () => awaitingDeferredTarget,
    onEscape: () => end('skipped')
  })

  function trackTour(stage: TourStage) {
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

  // Steps the user advances by interacting with the target (click/close), not Next.
  const expectsTargetInteraction = computed(
    () => !!step.value?.advanceOnTargetClick
  )

  const outlinePulsing = computed(
    () => pulsing.value && expectsTargetInteraction.value
  )

  // Last step's "Done" already dismisses, so hide Skip unless the step has no primary button.
  const showSkip = computed(
    () => !isLast.value || expectsTargetInteraction.value
  )

  function clearPulse() {
    clearTimeout(pulseTimer)
    pulsing.value = false
  }

  /** Pulse the outline if the user stalls on a step they must interact with. */
  function schedulePulse() {
    clearPulse()
    if (!expectsTargetInteraction.value) return
    pulseTimer = setTimeout(() => {
      pulsing.value = true
    }, PULSE_IDLE_MS)
  }

  async function showStep(idx: number) {
    stepController?.abort()
    const controller = new AbortController()
    stepController = controller
    const { signal } = controller
    // This call now owns the suspend flag; a superseded call must not clear it.
    awaitingDeferredTarget = false
    const nextStep = steps.value[idx]
    if (!nextStep) return
    if (
      nextStep.deferTarget &&
      nextStep.coachId &&
      !targetMounted(nextStep.coachId)
    ) {
      awaitingDeferredTarget = true
      const found = await waitForTarget(
        nextStep.coachId,
        signal,
        DEFER_TIMEOUT_MS
      )
      if (signal.aborted) return
      awaitingDeferredTarget = false
      // Target never appeared — abandon without setting the seen-flag, so the miss isn't permanent.
      if (!found) {
        end('skipped', false)
        return
      }
    }
    stepIdx.value = idx
    measure()
    schedulePulse()
    trackTour('step_shown')
    if (nextStep.deferTarget) settle(signal)
    // Reclaim the top of the modal stack — a deferred dialog may have registered above us.
    void raiseOverlay()
    void focusTrap.focusCard()
  }

  async function raiseOverlay() {
    await nextTick()
    if (overlayRef.value)
      ZIndex.set(MODAL_Z_KEY, overlayRef.value, MODAL_Z_BASE)
  }

  function next() {
    if (isLast.value) {
      end('completed')
      return
    }
    void showStep(stepIdx.value + 1)
  }

  const { loadTemplates, loadWorkflowTemplate } = useTemplateWorkflows()
  const { toastErrorHandler } = useErrorHandling()

  async function onPrimary() {
    try {
      const templateId = step.value?.loadTemplate
      if (templateId) {
        await loadTemplates()
        await loadWorkflowTemplate(templateId, 'default')
      }
    } catch (e) {
      toastErrorHandler(e)
      return
    }
    next()
  }

  function end(outcome: 'completed' | 'skipped', markSeen = true) {
    trackTour(outcome)
    clearPulse()
    stepController?.abort()
    if (overlayRef.value) ZIndex.clear(overlayRef.value)
    steps.value = []
    stepIdx.value = 0
    if (markSeen && activeTour) markTourSeen(activeTour)
    activeTour = null
  }

  onBeforeUnmount(() => {
    clearTimeout(startTimer)
    clearPulse()
    stepController?.abort()
    if (overlayRef.value) ZIndex.clear(overlayRef.value)
  })

  // Advance click-to-advance steps when the spotlighted target is clicked.
  useEventListener(
    document,
    'click',
    (e: MouseEvent) => {
      if (!step.value?.advanceOnTargetClick) return
      const target = targetEl.value
      if (target && e.composedPath().includes(target)) next()
    },
    { capture: true }
  )

  // Entering app mode opens the app-mode tour (startTour guards re-entry).
  const { isAppMode } = useAppMode()
  watch(isAppMode, (active) => {
    if (active) startTour('appMode')
  })

  // Re-resolve the spotlight when the step's target mounts, unmounts or swaps.
  watch(candidateEls, () => {
    if (!stepController) return
    const { signal } = stepController
    void nextTick(() => {
      if (signal.aborted) return
      measure()
      if (step.value?.deferTarget) settle(signal)
    })
  })

  function isEntryPath(value: string): value is EntryPath {
    return value in TOURS
  }

  function hasSeenTour(entryPath: EntryPath): boolean {
    return settingStore.get(SEEN_SETTING).includes(entryPath)
  }

  function markTourSeen(entryPath: EntryPath) {
    const seen = settingStore.get(SEEN_SETTING)
    if (seen.includes(entryPath)) return
    void settingStore.set(SEEN_SETTING, [...seen, entryPath])
  }

  let forcedTour: ForcedTour | null = null

  function startTour(entryPath: EntryPath, force = false) {
    // A tour is already showing or mid-resolution this session.
    if (steps.value.length || starting) return
    starting = true
    try {
      const replay = force || forcedTour === 'any' || forcedTour === entryPath
      if (!replay && hasSeenTour(entryPath)) return
      const resolved = resolveSteps(TOURS[entryPath], {
        isMounted: targetMounted
      })
      if (!resolved.length) return
      steps.value = resolved
      activeTour = entryPath
      trackTour('started')
      void showStep(0)
    } finally {
      starting = false
    }
  }

  onMounted(() => {
    // appMode opens via the isAppMode watcher; `?coach=` forces a tour at load.
    // Snapshot it before URL loaders strip their params.
    const coachParam = new URLSearchParams(window.location.search).get('coach')
    if (coachParam === null) return
    forcedTour = isEntryPath(coachParam) ? coachParam : 'any'
    if (!isEntryPath(coachParam)) return
    startTimer = setTimeout(() => startTour(coachParam), START_DELAY_MS)
  })

  // An explicit request (e.g. info button) replays the tour past its seen-flag.
  const { onTourRequested } = useCoachmarkController()
  onTourRequested((tour) => startTour(tour, true))

  return {
    step,
    countedSteps,
    countedStepIdx,
    targetRect,
    primaryLabel,
    skipLabel,
    expectsTargetInteraction,
    outlinePulsing,
    showSkip,
    onPrimary,
    end
  }
}
