import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints,
  useEventListener
} from '@vueuse/core'
import { delay } from 'es-toolkit'
import { computed, onScopeDispose, readonly, ref, shallowRef, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getExecutionImage } from '@/platform/execution/executionLifecycle'
import type { ExecutionOutputSelector } from '@/platform/execution/executionLifecycle'
import {
  EXECUTION_ACCEPTANCE_TIMEOUT_MS,
  EXECUTION_CONNECTION_TIMEOUT_MS,
  useExecutionLifecycleStore
} from '@/platform/execution/executionLifecycleStore'
import type { ExecutionHandle } from '@/platform/execution/executionLifecycleStore'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import { reportError } from '@/platform/telemetry/reportError'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

import { resolvePinnedImageOutput } from '../roles/resolvePinnedImageOutput'
import {
  firstRunTourSteps,
  releaseFirstRunTargets
} from './firstRunTourDefinition'
import type { RunState } from './firstRunTourDefinition'

const RUN_BUTTON_SELECTOR =
  '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]'
const INTRO_PREVIEW_MS = 500

interface TourExecution {
  handle: ExecutionHandle
  output: ExecutionOutputSelector | null
  templateId: string | undefined
}

function useFirstRunTourControllerInternal() {
  const engine = useOnboardingTourStore()
  const billing = useBillingContext()
  const executions = useExecutionLifecycleStore()
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const desktopLayout = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
  const tourWorkflow = shallowRef<ComfyWorkflow | null>(null)
  let tourTemplateId: string | undefined
  const nudgeArmed = ref(false)
  const tourExecution = shallowRef<TourExecution | null>(null)
  const executionState = computed(() => tourExecution.value?.handle.state.value)
  const firstRunOutput = computed(() => {
    const execution = tourExecution.value
    return execution
      ? getExecutionImage(execution.handle.state.value, execution.output)
      : null
  })
  const nudgeCompletedAt = computed(() => {
    const state = executionState.value
    return state?.phase === 'accepted' && state.job.phase === 'succeeded'
      ? state.job.completedAt
      : null
  })
  const runState = computed<RunState>(() => {
    const state = executionState.value
    if (!state) return 'idle'
    if (state.phase === 'pending') return 'generating'
    if (state.phase !== 'accepted') return 'failed'
    if (state.job.phase === 'running') return 'generating'
    return state.job.phase === 'succeeded' ? 'succeeded' : 'failed'
  })

  /**
   * The half of the tour's context that exists before the tour does: a canvas
   * the steps can point at. Linear mode `display:none`s it entirely, and below
   * the desktop layout the spotlights are placed against a screen that isn't
   * there. Split out so it can also serve as the precondition for opening one.
   */
  const canvasContextHolds = computed(
    () => desktopLayout.value && !canvasStore.linearMode
  )

  // The tour's node ids are graph-local, so they only describe the workflow it
  // resolved against: swapping workflows leaves it pointing at strangers.
  const tourContextHolds = computed(
    () =>
      canvasContextHolds.value &&
      workflowStore.activeWorkflow === tourWorkflow.value
  )

  const onRunStep = computed(
    () =>
      engine.activeTour === 'firstRun' &&
      engine.step?.kind === 'spotlight' &&
      engine.step.selfAdvancing === true
  )

  const submissionListener = executions.onSubmitted((handle) => {
    if (
      tourExecution.value ||
      !onRunStep.value ||
      handle.workflowInstanceId !== tourWorkflow.value?.instanceId
    )
      return
    tourExecution.value = {
      handle,
      templateId: tourTemplateId,
      output: resolvePinnedImageOutput(app.rootGraphOrUndefined, tourTemplateId)
    }
    engine.next()
  })
  onScopeDispose(submissionListener.off)

  watch(
    executionState,
    (state) => {
      if (state?.phase !== 'abandoned') return
      const execution = tourExecution.value
      reportError(new Error('First-run execution correlation timed out'), {
        errorType: 'error_correlating_first_run_execution',
        level: 'warning',
        tags: {
          failure_category: 'execution_correlation',
          failure_reason: state.reason
        },
        context: {
          templateId: execution?.templateId,
          requestId: execution?.handle.requestId,
          phase: state.previousPhase,
          jobId: state.jobId,
          outputNodeId: execution?.output?.nodeId,
          timeoutMs:
            state.reason === 'acceptance_timeout'
              ? EXECUTION_ACCEPTANCE_TIMEOUT_MS
              : EXECUTION_CONNECTION_TIMEOUT_MS
        }
      })
    },
    { flush: 'sync' }
  )

  useEventListener(
    document,
    'click',
    (event: MouseEvent) => {
      if (!onRunStep.value) return
      if (!(event.target instanceof Element)) return
      if (!event.target.closest(RUN_BUTTON_SELECTOR)) return
      if (!billing.canRunWorkflows.value) engine.postpone()
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
      tourTemplateId = undefined
    }
  )

  function dismissNudge() {
    nudgeArmed.value = false
    tourExecution.value = null
  }

  /** False when there is no tour to give; any renderer switch is undone. */
  async function beginTour(templateId?: string): Promise<boolean> {
    if (engine.activeTour) return false
    // Holds only ever end a tour that is already running, and only when they
    // change — a context lost before the tour opens (`?template=X&mode=linear`
    // boots straight into linear mode) never produces that change. Refused
    // here, ahead of the renderer switch below, so nothing is left to undo.
    if (!canvasContextHolds.value) return false

    const enabledForTour = !settingStore.get('Comfy.VueNodes.Enabled')
    if (enabledForTour) await settingStore.set('Comfy.VueNodes.Enabled', true)

    tourWorkflow.value = workflowStore.activeWorkflow ?? null
    tourTemplateId = templateId
    nudgeArmed.value = false
    tourExecution.value = null
    registerTour(
      'firstRun',
      () => firstRunTourSteps(templateId, runState),
      tourContextHolds
    )
    await delay(INTRO_PREVIEW_MS)
    // The preview is long enough for the canvas to go away underneath it, and
    // the holds watcher cannot catch that: there is no active tour to end yet.
    const contextStillHolds = (): boolean => canvasContextHolds.value
    const started = contextStillHolds() && (await engine.startTour('firstRun'))
    if (!started) {
      releaseFirstRunTargets()
      tourWorkflow.value = null
      tourTemplateId = undefined
      if (enabledForTour)
        await settingStore.set('Comfy.VueNodes.Enabled', false)
    }
    return started
  }

  return {
    beginTour,
    nudgeArmed: readonly(nudgeArmed),
    nudgeCompletedAt,
    nudgeOutput: readonly(firstRunOutput),
    dismissNudge
  }
}

export const useFirstRunTourController = createSharedComposable(
  useFirstRunTourControllerInternal
)
