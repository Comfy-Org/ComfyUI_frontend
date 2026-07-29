import { createSharedComposable, useEventListener } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { computed, readonly, ref, shallowRef, watch } from 'vue'

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

/** An undimmed look at the workflow the user chose, before the tour dims it. */
const INTRO_PREVIEW_MS = 500

function useFirstRunTourControllerInternal() {
  const engine = useOnboardingTourStore()
  const billing = useBillingContext()
  const executionStore = useExecutionStore()
  const executionErrorStore = useExecutionErrorStore()
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()

  const tourWorkflow = shallowRef<ComfyWorkflow | null>(null)
  const nudgeArmed = ref(false)
  const onRunStep = computed(
    () => engine.activeTour === 'firstRun' && engine.step?.name === 'run'
  )

  /** Recorded, not derived: the queue clears a status as soon as it turns terminal. */
  const runState = ref<RunState>('idle')
  watch(
    () => [
      executionStore.getWorkflowStatus(tourWorkflow.value),
      executionErrorStore.hasNodeError || executionErrorStore.hasPromptError
    ],
    ([status, refused]) => {
      if (status === 'running') runState.value = 'generating'
      else if (status === 'completed') runState.value = 'succeeded'
      else if (status === 'failed') runState.value = 'failed'
      else if (refused && runState.value === 'generating')
        runState.value = 'failed'
    }
  )

  /**
   * A run outlives the step that starts it, so the click moves the tour on. One
   * the paywall will refuse never queues, so it is consumed and the tour parked.
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

  /** False when this graph has no tour to give; the caller keeps it loaded. */
  async function beginTour(templateId?: string): Promise<boolean> {
    // A new user has no Comfy.InstalledVersion, so the versioned default never
    // applies and Nodes 2.0 reads off — the tour's own audience.
    if (!settingStore.get('Comfy.VueNodes.Enabled'))
      await settingStore.set('Comfy.VueNodes.Enabled', true)

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
