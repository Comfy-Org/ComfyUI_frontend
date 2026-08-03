import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints,
  useEventListener
} from '@vueuse/core'
import { delay } from 'es-toolkit'
import { computed, ref, shallowRef, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
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

const OFFLINE_GRACE_MS = 20_000

/** How long a submitted run has to be accepted before the card stops promising. */
const ACCEPT_DEADLINE_MS = 15_000

function useFirstRunTourControllerInternal() {
  const engine = useOnboardingTourStore()
  const billing = useBillingContext()
  const executionStore = useExecutionStore()
  const workflowStore = useWorkflowStore()
  const settingStore = useSettingStore()
  const desktopLayout = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
  const tourWorkflow = shallowRef<ComfyWorkflow | null>(null)
  const tourContextHolds = computed(
    () =>
      desktopLayout.value && workflowStore.activeWorkflow === tourWorkflow.value
  )

  const onRunStep = computed(
    () =>
      engine.activeTour === 'firstRun' &&
      engine.step?.kind === 'spotlight' &&
      engine.step.selfAdvancing === true
  )

  /** Recorded, not derived: the queue clears a status as soon as it turns terminal. */
  const runState = ref<RunState>('idle')
  watch(
    () => executionStore.getWorkflowStatus(tourWorkflow.value),
    (status, previous) => {
      if (status !== undefined) stopAcceptDeadline()
      if (status === 'running') runState.value = 'generating'
      else if (status === 'completed') runState.value = 'succeeded'
      else if (status === 'failed') runState.value = 'failed'
      else if (status === undefined && previous === 'running')
        runState.value = 'failed'
    }
  )

  /**
   * A submission the backend refuses never gets a prompt_id, so no status ever
   * appears and none of the branches above can fire. Account preconditions —
   * sign-in, subscription, credits — are deliberately kept out of the error
   * stores by `ComfyApp.queuePrompt`, so the refusal is invisible there too.
   * Give acceptance a deadline. Only acceptance: any status at all clears it,
   * so a run that is merely slow is never cut short.
   */
  let acceptTimer: ReturnType<typeof setTimeout> | undefined
  function stopAcceptDeadline() {
    clearTimeout(acceptTimer)
    acceptTimer = undefined
  }
  function startAcceptDeadline() {
    stopAcceptDeadline()
    acceptTimer = setTimeout(() => {
      stopAcceptDeadline()
      if (runState.value === 'generating') runState.value = 'failed'
    }, ACCEPT_DEADLINE_MS)
  }

  let offlineTimer: ReturnType<typeof setTimeout> | undefined
  function stopOfflineGrace() {
    clearTimeout(offlineTimer)
    offlineTimer = undefined
  }
  useEventListener(api, 'reconnecting', () => {
    if (runState.value !== 'generating' || offlineTimer) return
    offlineTimer = setTimeout(() => {
      stopOfflineGrace()
      if (runState.value === 'generating') runState.value = 'failed'
    }, OFFLINE_GRACE_MS)
  })
  useEventListener(api, 'reconnected', stopOfflineGrace)

  /**
   * A run outlives the step that starts it, so the click moves the tour on. One
   * the paywall will refuse never queues, so the tour parks and leaves the
   * subscribe button to open its own dialog.
   */
  useEventListener(
    document,
    'click',
    (event: MouseEvent) => {
      if (!onRunStep.value) return
      if (!(event.target instanceof Element)) return
      if (!event.target.closest(RUN_BUTTON_SELECTOR)) return

      if (!billing.canRunWorkflows.value) {
        engine.postpone()
        return
      }

      runState.value = 'generating'
      startAcceptDeadline()
      engine.next()
    },
    { capture: true }
  )

  watch(
    () => engine.activeTour === 'firstRun',
    (active) => {
      if (active) return
      stopOfflineGrace()
      stopAcceptDeadline()
      releaseFirstRunTargets()
      tourWorkflow.value = null
      runState.value = 'idle'
    }
  )

  /** False when there is no tour to give; any renderer switch is undone. */
  async function beginTour(templateId: string): Promise<boolean> {
    if (engine.activeTour) return false

    const enabledForTour = !settingStore.get('Comfy.VueNodes.Enabled')
    if (enabledForTour) await settingStore.set('Comfy.VueNodes.Enabled', true)

    tourWorkflow.value = workflowStore.activeWorkflow ?? null
    runState.value = 'idle'
    registerTour(
      'firstRun',
      () => firstRunTourSteps(templateId, runState),
      tourContextHolds
    )
    await delay(INTRO_PREVIEW_MS)
    const started = await engine.startTour('firstRun')
    if (!started) {
      releaseFirstRunTargets()
      tourWorkflow.value = null
      if (enabledForTour)
        await settingStore.set('Comfy.VueNodes.Enabled', false)
    }
    return started
  }

  return { beginTour }
}

export const useFirstRunTourController = createSharedComposable(
  useFirstRunTourControllerInternal
)
