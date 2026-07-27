import { createSharedComposable, useEventListener } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { computed, readonly, ref, shallowRef, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'

import { canvasTransformValid } from './canvasCoachTarget'
import {
  firstRunTourSteps,
  releaseFirstRunTargets
} from './firstRunTourDefinition'
import type { RunState } from './firstRunTourDefinition'

const RUN_BUTTON_SELECTOR =
  '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]'

/** An undimmed look at the workflow the user chose, before the tour dims it. */
const INTRO_PREVIEW_MS = 500

function useFirstRunTourControllerInternal() {
  const engine = useOnboardingTourStore()
  const billing = useBillingContext()
  const executionStore = useExecutionStore()
  const executionErrorStore = useExecutionErrorStore()
  const workflowStore = useWorkflowStore()

  const tourWorkflow = shallowRef<ComfyWorkflow | null>(null)
  const runState = ref<RunState>('idle')
  const nudgeArmed = ref(false)
  const onRunStep = computed(
    () => engine.activeTour === 'firstRun' && engine.step?.name === 'run'
  )

  /**
   * A run outlives the step that starts it, so the click moves the tour on and
   * the Result step reports how it goes. A run the paywall will refuse never
   * queues at all, so that click is consumed and the tour postponed — whoever
   * subscribes off the back of it still has their first run ahead of them.
   */
  useEventListener(
    document,
    'click',
    (event: MouseEvent) => {
      if (!onRunStep.value) return
      if (!(event.target instanceof Element)) return
      if (!event.target.closest(RUN_BUTTON_SELECTOR)) return

      if (!billing.canRunWorkflows.value) {
        event.preventDefault()
        event.stopImmediatePropagation()
        billing.showSubscriptionDialog({ reason: 'out_of_credits' })
        engine.postpone()
        return
      }

      runState.value = 'generating'
      if (engine.isLast) engine.complete()
      else engine.next()
    },
    { capture: true }
  )

  /**
   * The queue maps each job to the workflow that submitted it, so a job from
   * anywhere else cannot speak for this tour.
   */
  watch(
    () => executionStore.getWorkflowStatus(tourWorkflow.value),
    (status) => {
      if (!status || engine.activeTour !== 'firstRun') return
      if (status === 'running') runState.value = 'generating'
      else runState.value = status === 'failed' ? 'failed' : 'succeeded'
    }
  )

  /**
   * A prompt the queue refuses is never executed, so no status ever reports it
   * and the error it raises instead is the only word the Result step gets.
   */
  watch(
    () =>
      executionErrorStore.hasNodeError || executionErrorStore.hasPromptError,
    (refused) => {
      if (refused && runState.value === 'generating') runState.value = 'failed'
    }
  )

  watch(
    () => engine.activeTour === 'firstRun',
    (active) => {
      if (active) return
      nudgeArmed.value = true
      releaseFirstRunTargets()
      tourWorkflow.value = null
      runState.value = 'idle'
    }
  )

  function dismissNudge() {
    nudgeArmed.value = false
  }

  /** False when this template has no tour to give; the caller keeps the loaded graph. */
  async function beginTour(templateId: string): Promise<boolean> {
    if (!canvasTransformValid()) return false

    tourWorkflow.value = workflowStore.activeWorkflow ?? null
    runState.value = 'idle'
    nudgeArmed.value = false
    registerTour('firstRun', () => firstRunTourSteps(templateId, runState))
    await delay(INTRO_PREVIEW_MS)
    const started = await engine.startTour('firstRun')
    if (!started) {
      releaseFirstRunTargets()
      tourWorkflow.value = null
    }
    return started
  }

  return { beginTour, nudgeArmed: readonly(nudgeArmed), dismissNudge }
}

export const useFirstRunTourController = createSharedComposable(
  useFirstRunTourControllerInternal
)
