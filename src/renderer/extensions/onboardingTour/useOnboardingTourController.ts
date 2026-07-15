import { createSharedComposable, until, useEventListener } from '@vueuse/core'
import { computed, effectScope, ref, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useTelemetry } from '@/platform/telemetry'
import { api } from '@/scripts/api'
import type {
  OnboardingTourEntry,
  OnboardingTourRunStatus,
  OnboardingTourShape
} from '@/platform/telemetry/types'
import type { OnboardingCandidateDeps } from '@/platform/workflow/persistence/onboardingEntryStore'
import { isOnboardingCandidate } from '@/platform/workflow/persistence/onboardingEntryStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNewUserService } from '@/services/useNewUserService'
import type { NodeId } from '@/types/nodeId'

import {
  RUN_BUTTON_SELECTOR,
  canvasTransformValid,
  nodesPresent
} from './canvasSpotlightAdapter'
import { resolveTourRoles } from './roleResolution'
import {
  isUpgradeModalOpen,
  useOnboardingTourStore
} from './onboardingTourStore'
import type { TourEndReason } from './onboardingTourStore'
import { restoreView } from './subgraphNavigation'
import type { ResolvedRoles } from './tourSequence'

/** Budget for the serialized snapshot to appear (guards the URL blank-load race). */
const ACTIVE_STATE_TIMEOUT_MS = 1500
/** Budget for the live canvas graph to contain the resolved role nodes. */
const READY_TIMEOUT_MS = 3000

/** Top-level nodes the sequence actually spotlights (upload, prompt host, sink). */
function roleAnchorIds(roles: ResolvedRoles): NodeId[] {
  return [
    roles.source?.nodeId,
    roles.prompt?.subgraphNodeId,
    roles.sink?.nodeId
  ].filter((id): id is NodeId => id != null)
}

/** The live graph holds the resolved anchors and the canvas has a usable transform. */
function liveGraphReady(roles: ResolvedRoles): boolean {
  return nodesPresent(roleAnchorIds(roles)) && canvasTransformValid()
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

interface BeginTourOptions {
  templateId?: string
  entry?: OnboardingTourEntry
}

function _useOnboardingTourController() {
  const store = useOnboardingTourStore()
  const onboardingDeps: OnboardingCandidateDeps = {
    subscription: useSubscription(),
    newUserService: useNewUserService(),
    featureFlags: useFeatureFlags()
  }

  /** True while the loader is up: template chosen, tour not yet started. */
  const isPreparing = ref(false)

  /** Retained from `start` so completion/skip telemetry carries the same tags. */
  let activeTemplateId: string | undefined
  let activeShape: OnboardingTourShape = 'other'
  /** Guards RunTriggered against re-firing on a second run. */
  let runReported = false
  /** Stops the per-tour run watcher; set while a tour is live. */
  let stopRunListener: (() => void) | undefined
  /** Stops the Run-button click listener; set only while on the Run step. */
  let stopRunClick: (() => void) | undefined
  /** Guards the post-run outcome so only the first finished run acts. */
  let runOutcomeHandled = false

  /** True when the sequence has no step after Run, so a finished run ends the tour. */
  function runIsTerminalStep(): boolean {
    return store.steps.at(-1)?.kind === 'run'
  }

  /**
   * Handle the run finishing. `execution_success` captures the Result media;
   * every outcome reports the run with its real status and surfaces the nudge.
   * When Run is the last step (no Result follows), a finished run completes the
   * tour so `Completed` fires — otherwise the Result step drives completion.
   */
  function handleRunOutcome(status: OnboardingTourRunStatus) {
    // Armed in start(); ignore events before Run so they can't fire out of order.
    if (store.currentStep?.kind !== 'run') return
    if (runOutcomeHandled) return
    runOutcomeHandled = true
    if (status === 'success') void store.captureResultMedia()
    reportRunTriggered(status)
    if (runIsTerminalStep()) {
      end('done')
    } else {
      store.showNudge()
    }
  }

  /**
   * On the run's completion, resolve the Result media, report the run, and
   * surface the nudge — keyed to the real execution outcome (success vs
   * error/interrupt), NOT the ambiguous `activeJobId` reset which also fires on
   * failures. NOT the step advance: that fires on the Run click (see
   * {@link listenForRunClick}). Owned by a detached scope because `start()` runs
   * inside the Getting Started screen's setup, which unmounts right after — a
   * component-scoped listener would be disposed before the user reaches Run.
   */
  function listenForFirstRun() {
    stopRunListener?.()
    runOutcomeHandled = false
    const scope = effectScope(true)
    scope.run(() => {
      useEventListener(api, 'execution_success', () =>
        handleRunOutcome('success')
      )
      useEventListener(api, 'execution_error', () => handleRunOutcome('error'))
      useEventListener(api, 'execution_interrupted', () =>
        handleRunOutcome('interrupted')
      )

      // A no-subscription run is blocked by the paywall before it queues, so no
      // execution event ever fires; end the tour when that modal opens so it
      // doesn't hang on the Result step. The nudge defers itself until it closes.
      const upgradeModalOpen = computed(() => isUpgradeModalOpen())
      watch(upgradeModalOpen, (open) => {
        if (open && store.phase === 'active') end('done')
      })
    })
    stopRunListener = () => scope.stop()
  }

  /**
   * The Run step advances the moment the user clicks the Run button — the click
   * is the honest "they ran it" signal and keeps the coach-mark moving instantly
   * (waiting for execution completion left it stuck on Run). Capture-phase so it
   * fires even though the overlay scrim sits above the toolbar.
   */
  function listenForRunClick() {
    stopRunClick?.()
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest(RUN_BUTTON_SELECTOR)) void advance()
    }
    document.addEventListener('click', onClick, true)
    stopRunClick = () => document.removeEventListener('click', onClick, true)
  }

  function reportRunTriggered(status: OnboardingTourRunStatus) {
    if (runReported) return
    runReported = true
    useTelemetry()?.trackOnboardingTourRunTriggered?.({
      template_id: activeTemplateId,
      shape: activeShape,
      status
    })
  }

  /** Whether the onboarding tour should run for this session. */
  function shouldStartTour(): boolean {
    return isOnboardingCandidate(onboardingDeps)
  }

  function shapeOf(roles: ResolvedRoles | null): OnboardingTourShape {
    if (!roles?.prompt || !roles.sink) return 'other'
    if (!roles.source) return 't2i'
    return roles.mediaKind === 'video' ? 'i2v' : 'image-edit'
  }

  /**
   * Serialize the loaded graph and run the tour on it. `entry` tags where the
   * tour was launched from; `?share=`/`?template=` arrivals pass `share_url`/
   * `template_url`, the Getting Started card keeps the default. Aborts cleanly if
   * gating fails or no workflow is active.
   */
  async function start(
    templateId?: string,
    entry: OnboardingTourEntry = 'getting_started'
  ) {
    if (!shouldStartTour()) return

    const workflow = useWorkflowStore().activeWorkflow?.activeState
    if (!workflow) {
      store.end()
      return
    }

    store.start(workflow, templateId)
    activeTemplateId = templateId
    activeShape = shapeOf(store.resolvedRoles)
    runReported = false
    listenForFirstRun()
    useTelemetry()?.trackOnboardingTourStarted?.({
      template_id: activeTemplateId,
      shape: activeShape,
      entry
    })
    await enterStep()
  }

  /**
   * Shared entry point for both the Getting Started card and the URL loaders.
   * Shows the loader, waits until the just-loaded template is actually present
   * on the live canvas, then starts the tour — so the overlay never paints over
   * a not-yet-rendered graph. Best-effort: on timeout it starts degraded rather
   * than trapping, and the loader always clears.
   */
  async function beginTour({
    templateId,
    entry = 'getting_started'
  }: BeginTourOptions = {}) {
    if (!shouldStartTour()) return
    if (isPreparing.value || store.phase === 'active') return

    isPreparing.value = true
    try {
      const workflowStore = useWorkflowStore()

      // Guards the URL path, where loadBlankWorkflow() precedes the template load.
      await until(() => workflowStore.activeWorkflow?.activeState).toBeTruthy({
        timeout: ACTIVE_STATE_TIMEOUT_MS,
        throwOnTimeout: false
      })
      const workflow = workflowStore.activeWorkflow?.activeState
      if (!workflow) return

      // Resolve from the same snapshot start() uses, then hold until the live
      // graph agrees — the spotlight reads the live graph, so they must match.
      const roles = resolveTourRoles(workflow, templateId)
      const ready = await until(() => liveGraphReady(roles)).toBe(true, {
        timeout: READY_TIMEOUT_MS,
        throwOnTimeout: false
      })
      if (!ready) {
        console.warn(
          '[onboardingTour] canvas readiness timed out; starting degraded',
          { templateId }
        )
      }

      await nextFrame()
      await start(templateId, entry)
      await nextFrame()
    } finally {
      isPreparing.value = false
    }
  }

  /** UX-only paywall check; real enforcement is server-side. Never gate on signup method. */
  function hasFunds(): boolean {
    return useBillingContext().subscription.value?.hasFunds === true
  }

  /**
   * Gate the Run step: funded users just proceed (the run itself is reported when
   * it actually succeeds, not on arrival here); no-funds users get the upgrade
   * modal and the tour ends. `end` surfaces the nudge, which defers itself while
   * the modal is open and appears once it closes. Returns true when gated.
   */
  function gateRunStep(): boolean {
    if (hasFunds()) return false

    useBillingContext().showSubscriptionDialog({ reason: 'out_of_credits' })
    useTelemetry()?.trackOnboardingTourUpgradeShown?.({
      template_id: activeTemplateId
    })
    end('done')
    return true
  }

  /** Set up the current step: gate the run, arm the run-click, spotlight the prompt. */
  async function enterStep() {
    stopRunClick?.()
    stopRunClick = undefined

    const step = store.currentStep
    if (!step) return

    if (step.kind === 'run') {
      if (gateRunStep()) return
      // Advance the instant the user clicks Run; the Result step's copy bridges
      // the generating→ready gap.
      listenForRunClick()
    }

    // Never enter the subgraph: spotlight the collapsed host's prompt port on the
    // root graph. restoreView is defensive if the user opened one manually.
    restoreView()

    useTelemetry()?.trackOnboardingTourStepViewed?.({
      step_key: step.kind,
      step_index: store.stepIndex,
      step_total: store.totalSteps
    })
  }

  async function advance() {
    store.advance()
    await enterStep()
  }

  async function back() {
    store.back()
    await enterStep()
  }

  function end(reason: TourEndReason) {
    if (store.phase !== 'active') return
    stopRunListener?.()
    stopRunListener = undefined
    stopRunClick?.()
    stopRunClick = undefined
    const telemetry = useTelemetry()
    if (reason === 'skip') {
      const step = store.currentStep
      if (step) {
        telemetry?.trackOnboardingTourSkipped?.({
          step_key: step.kind,
          step_index: store.stepIndex,
          step_total: store.totalSteps
        })
      }
    } else if (reason === 'done') {
      telemetry?.trackOnboardingTourCompleted?.({
        template_id: activeTemplateId,
        shape: activeShape
      })
    }
    store.showNudge()
    store.end()
  }

  return { shouldStartTour, beginTour, start, advance, back, end }
}

export const useOnboardingTourController = createSharedComposable(
  _useOnboardingTourController
)
