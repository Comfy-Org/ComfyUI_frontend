import { createSharedComposable, useEventListener } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'

import {
  firstRunTourSteps,
  releaseFirstRunTargets
} from './firstRunTourDefinition'
import type { RunState } from './firstRunTourDefinition'

const RUN_BUTTON_SELECTOR =
  '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]'

function useFirstRunTourControllerInternal() {
  const engine = useOnboardingTourStore()
  const billing = useBillingContext()
  const executionStore = useExecutionStore()
  const executionErrorStore = useExecutionErrorStore()
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()

  const tourWorkflow = shallowRef<ComfyWorkflow | null>(null)
  const onRunStep = computed(
    () => engine.activeTour === 'firstRun' && engine.step?.name === 'run'
  )

  const runState = ref<RunState>('idle')
  watch(
    () => executionStore.getWorkflowStatus(tourWorkflow.value),
    (status) => {
      if (status === 'running') runState.value = 'generating'
      else if (status === 'completed') runState.value = 'succeeded'
      else if (status === 'failed') runState.value = 'failed'
    }
  )
  watch(
    () =>
      executionErrorStore.hasNodeError || executionErrorStore.hasPromptError,
    (refused) => {
      if (refused && runState.value === 'generating') runState.value = 'failed'
    }
  )

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

  watch(
    () => engine.activeTour === 'firstRun',
    (active) => {
      if (active) return
      releaseFirstRunTargets()
      tourWorkflow.value = null
      runState.value = 'idle'
    }
  )

  async function beginTour(templateId?: string): Promise<boolean> {
    if (!settingStore.get('Comfy.VueNodes.Enabled'))
      await settingStore.set('Comfy.VueNodes.Enabled', true)
    tourWorkflow.value = workflowStore.activeWorkflow ?? null
    runState.value = 'idle'
    registerTour('firstRun', () => firstRunTourSteps(templateId, runState))
    const started = await engine.startTour('firstRun')
    if (!started) {
      releaseFirstRunTargets()
      tourWorkflow.value = null
    }
    return started
  }

  return { beginTour }
}

export const useFirstRunTourController = createSharedComposable(
  useFirstRunTourControllerInternal
)
