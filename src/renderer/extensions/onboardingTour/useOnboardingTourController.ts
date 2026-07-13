import { createSharedComposable } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import type { OnboardingTourShape } from '@/platform/telemetry/types'
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

  function clearGrace() {
    if (graceTimer !== undefined) {
      clearTimeout(graceTimer)
      graceTimer = undefined
    }
  }

  /**
   * Whether the onboarding tour should run for this session. Cloud-only, gated
   * behind the feature flag, shown once per user via `Comfy.TutorialCompleted`.
   */
  function shouldStartTour(): boolean {
    if (!isCloud) return false
    if (!useSubscription().isSubscriptionEnabled()) return false
    if (useNewUserService().isNewUser() !== true) return false
    if (!useFeatureFlags().flags.onboardingTourEnabled) return false
    if (useSettingStore().get('Comfy.TutorialCompleted')) return false
    return true
  }

  function shapeOf(roles: ResolvedRoles | null): OnboardingTourShape {
    if (!roles?.prompt || !roles.sink) return 'other'
    if (!roles.source) return 't2i'
    return roles.mediaKind === 'video' ? 'i2v' : 'image-edit'
  }

  /**
   * Serialize the loaded graph and run the tour on it. Aborts cleanly if gating
   * fails or no workflow is active.
   */
  async function start(templateId?: string) {
    if (!shouldStartTour()) return

    const workflow = useWorkflowStore().activeWorkflow?.activeState
    if (!workflow) {
      store.end()
      return
    }

    store.start(workflow, templateId)
    activeTemplateId = templateId
    activeShape = shapeOf(store.resolvedRoles)
    useTelemetry()?.trackOnboardingTourStarted?.({
      template_id: activeTemplateId,
      shape: activeShape,
      entry: 'getting_started'
    })
    await enterStep()
  }

  /** Set up the current step: focus the prompt (with port fallback) and arm the grace timer. */
  async function enterStep() {
    clearGrace()
    const step = store.currentStep
    if (!step) return

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
