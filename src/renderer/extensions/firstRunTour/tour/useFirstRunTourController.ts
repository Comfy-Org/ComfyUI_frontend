import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints,
  useEventListener
} from '@vueuse/core'
import { delay } from 'es-toolkit'
import { computed, readonly, ref, shallowRef, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type {
  ExecutedWsMessage,
  ExecutionStartWsMessage,
  ResultItem
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
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

const OFFLINE_GRACE_MS = 20_000

function useFirstRunTourControllerInternal() {
  const engine = useOnboardingTourStore()
  const billing = useBillingContext()
  const executionStore = useExecutionStore()
  const executionErrorStore = useExecutionErrorStore()
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const desktopLayout = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
  const tourWorkflow = shallowRef<ComfyWorkflow | null>(null)
  const nudgeArmed = ref(false)
  const tourWasCompleted = ref(false)
  const nudgeOutput = shallowRef<ResultItem | null>(null)
  const firstRunOutput = shallowRef<ResultItem | null>(null)
  let tourJobId: string | null = null

  // The tour's node ids are graph-local, so they only describe the workflow it
  // resolved against: swapping workflows leaves it pointing at strangers.
  // Linear mode hides the canvas entirely, so its nodes are nothing to point at.
  const tourContextHolds = computed(
    () =>
      desktopLayout.value &&
      !canvasStore.linearMode &&
      workflowStore.activeWorkflow === tourWorkflow.value
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
    () => [
      executionStore.getWorkflowStatus(tourWorkflow.value),
      executionErrorStore.hasNodeError || executionErrorStore.hasPromptError
    ],
    ([status, refused], previous) => {
      if (status === 'running') runState.value = 'generating'
      else if (status === 'completed') runState.value = 'succeeded'
      else if (status === 'failed') runState.value = 'failed'
      // A refused run never queues; a stopped one drops its status rather than
      // reporting an outcome. Both end the run, and neither says so.
      else if (refused && runState.value === 'generating')
        runState.value = 'failed'
      else if (status === undefined && previous?.[0] === 'running')
        runState.value = 'failed'
    }
  )

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

  useEventListener(api, 'execution_start', (event) => {
    const { detail } = event as CustomEvent<ExecutionStartWsMessage>
    if (
      engine.activeTour !== 'firstRun' ||
      runState.value !== 'generating' ||
      tourJobId
    )
      return
    tourJobId = detail.prompt_id
  })

  useEventListener(api, 'executed', (event) => {
    const { detail } = event as CustomEvent<ExecutedWsMessage>
    if (detail.prompt_id !== tourJobId || firstRunOutput.value) return
    const image = detail.output.images?.find(({ filename }) => filename)
    if (image) firstRunOutput.value = { ...image, type: image.type ?? 'output' }
  })

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
      engine.next()
    },
    { capture: true }
  )

  watch(
    () => engine.activeTour === 'firstRun',
    (active) => {
      if (active) return
      const ending = engine.lastEnding
      tourWasCompleted.value =
        ending?.tour === 'firstRun' && ending.outcome === 'completed'
      nudgeOutput.value = tourWasCompleted.value ? firstRunOutput.value : null
      nudgeArmed.value = nudgeOutput.value !== null
      stopOfflineGrace()
      releaseFirstRunTargets()
      tourWorkflow.value = null
      firstRunOutput.value = null
      tourJobId = null
      runState.value = 'idle'
    }
  )

  function dismissNudge() {
    nudgeArmed.value = false
  }

  /** False when there is no tour to give; any renderer switch is undone. */
  async function beginTour(templateId?: string): Promise<boolean> {
    if (engine.activeTour) return false

    const enabledForTour = !settingStore.get('Comfy.VueNodes.Enabled')
    if (enabledForTour) await settingStore.set('Comfy.VueNodes.Enabled', true)

    tourWorkflow.value = workflowStore.activeWorkflow ?? null
    runState.value = 'idle'
    nudgeArmed.value = false
    nudgeOutput.value = null
    firstRunOutput.value = null
    tourJobId = null
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

  return {
    beginTour,
    nudgeArmed: readonly(nudgeArmed),
    nudgeOutput: readonly(nudgeOutput),
    tourWasCompleted: readonly(tourWasCompleted),
    dismissNudge
  }
}

export const useFirstRunTourController = createSharedComposable(
  useFirstRunTourControllerInternal
)
