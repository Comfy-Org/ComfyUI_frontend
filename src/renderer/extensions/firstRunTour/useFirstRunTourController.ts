import { createSharedComposable, until, useEventListener } from '@vueuse/core'
import { computed, effectScope, ref, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useDesktopLayout } from '@/composables/useDesktopLayout'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
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
import { trackFirstRunTour } from './firstRunTourTelemetry'
import { resolveTourRoles } from './roleResolution'
import { isUpgradeModalOpen, useFirstRunTourStore } from './firstRunTourStore'
import type { TourEndReason } from './firstRunTourStore'
import { restoreView } from './subgraphNavigation'
import { shapeOf, toCoachSteps } from './tourSequence'
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

function _useFirstRunTourController() {
  const store = useFirstRunTourStore()
  const engine = useOnboardingTourStore()
  const onboardingDeps: OnboardingCandidateDeps = {
    subscription: useSubscription(),
    newUserService: useNewUserService(),
    featureFlags: useFeatureFlags(),
    desktop: useDesktopLayout()
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
   * Handle the run finishing: capture the media on success, report the real status,
   * and surface the nudge. When Run is the last step, this completes the tour;
   * otherwise the Result step does.
   */
  function handleRunOutcome(status: OnboardingTourRunStatus) {
    // The Run click advances to Result before the run reports, so accept either.
    const step = store.currentStep?.kind
    if (step !== 'run' && step !== 'result') return
    if (runOutcomeHandled) return
    runOutcomeHandled = true
    store.runFinished = true
    if (status === 'success') void store.captureResultMedia()
    reportRunTriggered(status)
    if (runIsTerminalStep()) {
      end('done')
    } else {
      store.showNudge()
    }
  }

  /**
   * Watch for the run to finish, keyed to the real execution outcome rather than the
   * `activeJobId` reset, which also fires on failure. Owned by a detached scope:
   * `start()` runs in the Getting Started screen's setup, which unmounts right after,
   * so a component-scoped listener would die before the user reaches Run.
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
        if (open && store.isActive) end('done')
      })
    })
    stopRunListener = () => scope.stop()
  }

  /**
   * Advance on the Run click rather than on execution completion, which left the mark
   * stuck on Run. Capture-phase, so it fires despite the scrim above the toolbar.
   */
  function listenForRunClick() {
    stopRunClick?.()
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest(RUN_BUTTON_SELECTOR)) return
      if (gateRunClick()) return
      // A terminal Run has no next step; the run outcome ends the tour.
      if (runIsTerminalStep()) return
      void advance()
    }
    document.addEventListener('click', onClick, true)
    stopRunClick = () => document.removeEventListener('click', onClick, true)
  }

  function reportRunTriggered(status: OnboardingTourRunStatus) {
    if (runReported) return
    runReported = true
    trackFirstRunTour('run_triggered', {
      template_id: activeTemplateId,
      shape: activeShape,
      status
    })
  }

  function shouldStartTour(): boolean {
    return isOnboardingCandidate(onboardingDeps)
  }

  /** Mirror the engine's position into our view store (the engine owns the sequence). */
  function syncFromEngine() {
    store.isActive = engine.activeTour === 'firstRun'
    store.stepIndex = engine.countedStepIdx
  }

  /**
   * Serialize the loaded graph and run the tour on it. Aborts cleanly if gating fails
   * or no workflow is active.
   *
   * @param entry Where the tour was launched from, for telemetry.
   */
  async function start(
    templateId?: string,
    entry: OnboardingTourEntry = 'getting_started'
  ) {
    if (!shouldStartTour()) return

    // The engine runs one tour at a time; don't preempt one already in progress.
    if (engine.activeTour) return

    const workflow = useWorkflowStore().activeWorkflow?.activeState
    if (!workflow) {
      store.end()
      return
    }

    store.prepare(workflow, templateId)
    engine.startTour('firstRun', {
      force: true,
      definition: toCoachSteps(store.steps)
    })
    if (engine.activeTour !== 'firstRun') return
    syncFromEngine()

    activeTemplateId = templateId
    const roles = store.resolvedRoles
    activeShape = roles ? shapeOf(roles) : 'other'
    runReported = false
    listenForFirstRun()
    trackFirstRunTour('started', {
      template_id: activeTemplateId,
      shape: activeShape,
      entry
    })
    await enterStep()
  }

  /**
   * Shared entry point for the Getting Started card and the URL loaders. Waits until
   * the template is present on the live canvas before starting, so the overlay never
   * paints over an unrendered graph. On timeout it starts degraded rather than trap.
   */
  async function beginTour({
    templateId,
    entry = 'getting_started'
  }: BeginTourOptions = {}): Promise<boolean> {
    if (!shouldStartTour()) return false
    if (isPreparing.value || store.isActive) return false

    isPreparing.value = true
    try {
      const workflowStore = useWorkflowStore()

      // Guards the URL path, where loadBlankWorkflow() precedes the template load.
      await until(() => workflowStore.activeWorkflow?.activeState).toBeTruthy({
        timeout: ACTIVE_STATE_TIMEOUT_MS,
        throwOnTimeout: false
      })
      const workflow = workflowStore.activeWorkflow?.activeState
      if (!workflow) return false

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
      return store.isActive
    } finally {
      isPreparing.value = false
    }
  }

  /** UX-only paywall check; real enforcement is server-side. Never gate on signup method. */
  function hasFunds(): boolean {
    return useBillingContext().subscription.value?.hasFunds === true
  }

  /**
   * Gate the Run click: no-funds users get the upgrade modal and the tour ends, with
   * the nudge deferring itself until that modal closes. Keyed to the click rather
   * than to arriving at the step, so a funded user is never paywalled on entry.
   *
   * @returns True when gated.
   */
  function gateRunClick(): boolean {
    if (hasFunds()) return false

    useBillingContext().showSubscriptionDialog({ reason: 'out_of_credits' })
    trackFirstRunTour('upgrade_shown', { template_id: activeTemplateId })
    end('done')
    return true
  }

  /** Set up the current step: arm the run-click, spotlight the prompt. */
  async function enterStep() {
    stopRunClick?.()
    stopRunClick = undefined

    const step = store.currentStep
    if (!step) return

    if (step.kind === 'run') listenForRunClick()

    // Defensive: the tour never enters a subgraph, but the user may have opened one.
    restoreView()

    trackFirstRunTour('step_shown', {
      template_id: activeTemplateId,
      step_key: step.kind,
      step_number: store.stepIndex + 1,
      step_count: store.totalSteps
    })
  }

  async function advance() {
    engine.next()
    syncFromEngine()
    await enterStep()
  }

  async function back() {
    engine.back()
    syncFromEngine()
    await enterStep()
  }

  function end(reason: TourEndReason) {
    if (!store.isActive) return
    stopRunListener?.()
    stopRunListener = undefined
    stopRunClick?.()
    stopRunClick = undefined
    if (reason === 'skip') {
      const step = store.currentStep
      if (step) {
        trackFirstRunTour('skipped', {
          template_id: activeTemplateId,
          step_key: step.kind,
          step_number: store.stepIndex + 1,
          step_count: store.totalSteps
        })
      }
    } else if (reason === 'done') {
      trackFirstRunTour('completed', {
        template_id: activeTemplateId,
        shape: activeShape
      })
    }
    engine.skip()
    store.showNudge()
    store.end()
  }

  return { shouldStartTour, beginTour, start, advance, back, end }
}

export const useFirstRunTourController = createSharedComposable(
  _useFirstRunTourController
)
