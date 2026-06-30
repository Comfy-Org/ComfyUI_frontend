import { ZIndex } from '@primeuix/utils/zindex'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { MODAL_Z_BASE, MODAL_Z_KEY } from '@/components/dialog/vRekaZIndex'
import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { app } from '@/scripts/app'

import { useCoachmarkController } from './coachmarkController'
import { NODES_2_GATE_STEP, TOURS, resolveSteps } from './onboardingTours'
import type { CoachId, CoachStep, EntryPath } from './onboardingTours'
import { useCoachmarkTarget } from './useCoachmarkTarget'
import { useFocusTrap } from './useFocusTrap'

const SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'
const START_DELAY_MS = 800
const DEFER_TIMEOUT_MS = 8000
// On steps the user must interact with the target, pulse the spotlight
// outline once they have stalled this long.
const PULSE_IDLE_MS = 4000

type TourStage = 'started' | 'step_shown' | 'completed' | 'skipped'

// `?coach=<path>` forces that tour; `?coach=1` (any non-path value) forces
// whichever tour the entry detection picks.
type ForcedTour = EntryPath | 'any'

// TourOverlay mounts exactly once (GraphView), so this composable is a de-facto
// singleton: a single state machine owning the document listeners and the
// app-mode watcher. A second concurrent mount would double-fire all of them, so
// guard against it rather than corrupt shared state silently.
let instanceActive = false

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
  const steps = ref<CoachStep[]>([])
  const stepIdx = ref(0)
  const pulsing = ref(false)
  let activeTour: EntryPath | null = null
  // Set synchronously before the gate resolution awaits, so a second trigger
  // (e.g. the app-mode watcher firing alongside an explicit request) can't slip
  // past the `steps.value.length` guard while the first tour is still resolving.
  let starting = false
  let startTimer: ReturnType<typeof setTimeout> | undefined
  let pulseTimer: ReturnType<typeof setTimeout> | undefined
  // Cancels the in-flight step's async work (deferred-target wait, frame settle,
  // close watcher) when the step advances, the tour ends, or the view unmounts.
  let stepController: AbortController | null = null
  // While a deferred target mounts, focus legitimately moves into it (dialog
  // autofocus) — suspend the focusin guard so the coach doesn't fight it.
  let awaitingDeferredTarget = false
  // Claim the single-instance guard synchronously, before the listeners and
  // watches below register, so a duplicate mount stays inert (its startTour
  // no-ops and every handler falls through on a null step) rather than racing
  // the owner. TourOverlay must be mounted exactly once.
  let ownsInstance = false
  if (instanceActive) {
    console.error(
      'useCoachmarkTour is already active — TourOverlay must be mounted exactly once.'
    )
  } else {
    instanceActive = true
    ownsInstance = true
  }

  const step = computed(() => steps.value[stepIdx.value] ?? null)
  const isLast = computed(() => stepIdx.value === steps.value.length - 1)

  // Landing steps are full-screen chrome, not part of the numbered progression,
  // so the step indicator counts only the spotlight steps.
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

  // The landing renders as a real Dialog that owns its own focus trap and escape
  // handling, so the cross-subtree trap only runs for spotlight steps.
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
    useTelemetry()?.trackOnboardingTour(stage, {
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

  // Steps the user advances by interacting with the target (clicking or closing
  // it) pulse the spotlight outline once they stall, and have no primary button.
  const expectsTargetInteraction = computed(
    () =>
      !!step.value?.advanceOnTargetClick || !!step.value?.advanceOnTargetClose
  )

  // The spotlight's outline pulses once the user stalls on a step they
  // must interact with.
  const outlinePulsing = computed(
    () => pulsing.value && expectsTargetInteraction.value
  )

  // On the last step the primary button reads "Done", which already dismisses
  // the tour — so Skip is redundant there (unless the step has no primary button).
  const showSkip = computed(
    () => !isLast.value || expectsTargetInteraction.value
  )

  function clearPulse() {
    clearTimeout(pulseTimer)
    pulsing.value = false
  }

  /** March the outline if the user stalls on a step they must interact with. */
  function schedulePulse() {
    clearPulse()
    if (!expectsTargetInteraction.value) return
    pulseTimer = setTimeout(() => {
      pulsing.value = true
    }, PULSE_IDLE_MS)
  }

  /** Advance once the (already-present) target unmounts, e.g. a dialog the user closes. */
  function watchForTargetClose(id: CoachId | CoachId[], signal: AbortSignal) {
    const stop = watch(
      () => targetMounted(id),
      (mounted) => {
        if (!mounted) {
          stop()
          next()
        }
      }
    )
    signal.addEventListener('abort', stop, { once: true })
  }

  async function showStep(idx: number) {
    stepController?.abort()
    const controller = new AbortController()
    stepController = controller
    const { signal } = controller
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
      awaitingDeferredTarget = false
      if (signal.aborted) return
      // The target never appeared — abandon without burning the seen-flag so a
      // transient failure doesn't cost the user their onboarding.
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
    if (nextStep.advanceOnTargetClose && nextStep.coachId)
      watchForTargetClose(nextStep.coachId, signal)
    // Reclaim the top of the shared modal sequence — a deferred dialog may have
    // registered above us since the last step.
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
      if (step.value?.enablesNodes2) {
        await settingStore.set('Comfy.VueNodes.Enabled', true)
      }
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
    if (markSeen && activeTour) markTourSeen(activeTour)
    activeTour = null
  }

  onBeforeUnmount(() => {
    if (ownsInstance) instanceActive = false
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

  // Entering app mode opens the app-mode tour (guarded against re-entry and an
  // already-running tour inside startTour).
  const { isAppMode } = useAppMode()
  watch(isAppMode, (active) => {
    if (active) void startTour('appMode')
  })

  // The registry tells us when the current step's target mounts, unmounts or
  // swaps (e.g. loading an app template hides the graph run button and mounts the
  // app run button). Re-resolve the spotlight to whichever element is now live.
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

  const { shouldRenderVueNodes } = useVueFeatureFlags()
  let forcedTour: ForcedTour | null = null

  async function startTour(entryPath: EntryPath, force = false) {
    if (!ownsInstance) return
    // A tour is already showing or mid-resolution this session.
    if (steps.value.length || starting) return
    starting = true
    try {
      const replay = force || forcedTour === 'any' || forcedTour === entryPath
      if (!replay && hasSeenTour(entryPath)) return
      const resolved = await resolveSteps(TOURS[entryPath], {
        bypassGates: replay,
        isMounted: targetMounted
      })
      if (!resolved.length) return
      // Canvas guidance assumes Nodes 2.0; lead with the opt-in when it's off.
      steps.value =
        entryPath === 'blankCanvas' && !shouldRenderVueNodes.value
          ? [NODES_2_GATE_STEP, ...resolved]
          : resolved
      activeTour = entryPath
      trackTour('started')
      void showStep(0)
    } finally {
      starting = false
    }
  }

  onMounted(() => {
    if (!ownsInstance) return
    // URL loaders strip their params after consuming them, so snapshot `?coach=`
    // here at mount (before any stripping) rather than reading the live location.
    const coachParam = new URLSearchParams(window.location.search).get('coach')
    if (coachParam !== null) {
      forcedTour = isEntryPath(coachParam) ? coachParam : 'any'
    }
    const forcedPath = coachParam && isEntryPath(coachParam) ? coachParam : null
    // Only blankCanvas is detected at load; appMode opens via the isAppMode
    // watcher. A forced `?coach=` path starts at load so it's testable without
    // driving the live trigger.
    const hasNodes = !!app.rootGraph?.nodes?.length
    const mountPath = forcedPath ?? (hasNodes ? null : 'blankCanvas')
    if (!mountPath) return
    startTimer = setTimeout(() => void startTour(mountPath), START_DELAY_MS)
  })

  // An explicit request (e.g. the app-mode info button) replays the tour past
  // its seen-flag and gates.
  const { onTourRequested } = useCoachmarkController()
  onTourRequested((tour) => void startTour(tour, true))

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
