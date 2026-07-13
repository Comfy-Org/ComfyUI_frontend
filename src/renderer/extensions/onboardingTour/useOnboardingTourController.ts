import { createSharedComposable } from '@vueuse/core'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type {
  OnboardingTourEntry,
  OnboardingTourShape
} from '@/platform/telemetry/types'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNewUserService } from '@/services/useNewUserService'

import { useOnboardingTourStore } from './onboardingTourStore'
import type { TourEndReason } from './onboardingTourStore'
import { focusPromptTarget } from './subgraphNavigation'
import type { ResolvedRoles } from './tourSequence'

/** No auto-step may trap the user; advance after this grace period. */
const AUTO_STEP_GRACE_MS = 8000

function _useOnboardingTourController() {
  const store = useOnboardingTourStore()

  let graceTimer: ReturnType<typeof setTimeout> | undefined
  /** Retained from `start` so completion/skip telemetry carries the same tags. */
  let activeTemplateId: string | undefined
  let activeShape: OnboardingTourShape = 'other'
  /** Guards RunTriggered against re-firing when the user navigates back into Run. */
  let runReported = false

  function clearGrace() {
    if (graceTimer !== undefined) {
      clearTimeout(graceTimer)
      graceTimer = undefined
    }
  }

  /**
   * Whether the onboarding tour should run for this session. Cloud-only, gated
   * behind the feature flag and shown once per user via `isNewUser()`.
   */
  function shouldStartTour(): boolean {
    if (!isCloud) return false
    if (!useSubscription().isSubscriptionEnabled()) return false
    if (useNewUserService().isNewUser() !== true) return false
    if (!useFeatureFlags().flags.onboardingTourEnabled) return false
    return true
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
    useTelemetry()?.trackOnboardingTourStarted?.({
      template_id: activeTemplateId,
      shape: activeShape,
      entry
    })
    await enterStep()
  }

  /** UX-only paywall check; real enforcement is server-side. Never gate on signup method. */
  function hasFunds(): boolean {
    return useBillingContext().subscription.value?.hasFunds === true
  }

  /**
   * Gate the Run step: funded users fire run telemetry and proceed; no-funds
   * users get the upgrade modal, the nudge flag, and the tour ends. Completion
   * is written by the load seam, not here. Returns true when gated.
   */
  function gateRunStep(): boolean {
    if (hasFunds()) {
      if (!runReported) {
        runReported = true
        useTelemetry()?.trackOnboardingTourRunTriggered?.({
          template_id: activeTemplateId,
          shape: activeShape
        })
      }
      return false
    }

    useBillingContext().showSubscriptionDialog({ reason: 'out_of_credits' })
    useTelemetry()?.trackOnboardingTourUpgradeShown?.({
      template_id: activeTemplateId
    })
    store.markNudgePending()
    end('done')
    return true
  }

  /** Set up the current step: focus the prompt (with port fallback) and arm the grace timer. */
  async function enterStep() {
    clearGrace()
    const step = store.currentStep
    if (!step) return

    if (step.kind === 'run' && gateRunStep()) return

    if (step.kind === 'prompt' && step.prompt) {
      store.promptPortFallback = !(await focusPromptTarget(step.prompt))
    }

    useTelemetry()?.trackOnboardingTourStepViewed?.({
      step_key: step.kind,
      step_index: store.stepIndex,
      step_total: store.totalSteps
    })

    if (store.phase === 'active' && store.stepIndex < store.totalSteps - 1) {
      graceTimer = setTimeout(() => {
        void advance()
      }, AUTO_STEP_GRACE_MS)
    }
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
    clearGrace()
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
    store.end()
  }

  return { shouldStartTour, start, advance, back, end }
}

export const useOnboardingTourController = createSharedComposable(
  _useOnboardingTourController
)
