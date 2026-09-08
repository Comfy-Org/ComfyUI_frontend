import {
  breakpointsTailwind,
  createSharedComposable,
  useBreakpoints,
  useEventListener
} from '@vueuse/core'
import { delay } from 'es-toolkit'
import { computed, onScopeDispose, readonly, ref, shallowRef, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { registerTour } from '@/platform/onboarding/onboardingTours'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { resultItemType } from '@/schemas/apiSchema'
import type {
  ExecutedWsMessage,
  ExecutionSuccessWsMessage,
  ResultItem
} from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExecutionStore } from '@/stores/executionStore'
import { parseNodeOutput } from '@/stores/resultItemParsing'
import { isImageResult } from '@/utils/resultItem'

import { transitionFirstRunCorrelation } from './firstRunCorrelation'
import type {
  FirstRunCorrelationEvent,
  FirstRunCorrelationState
} from './firstRunCorrelation'
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
  const executionErrorStore = useExecutionErrorStore()
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const desktopLayout = useBreakpoints(breakpointsTailwind).greaterOrEqual('md')
  const tourWorkflow = shallowRef<ComfyWorkflow | null>(null)
  const nudgeArmed = ref(false)
  const runCorrelation = shallowRef<FirstRunCorrelationState>({
    phase: 'idle',
    output: null
  })
  const firstRunOutput = computed(() => runCorrelation.value.output)
  const nudgeCompletedAt = computed(() =>
    runCorrelation.value.phase === 'succeeded'
      ? runCorrelation.value.completedAt
      : null
  )

  function dispatchRunCorrelation(event: FirstRunCorrelationEvent) {
    runCorrelation.value = transitionFirstRunCorrelation(
      runCorrelation.value,
      event
    )
    if (runCorrelation.value.phase !== 'pending') stopAcceptDeadline()
    if (
      runCorrelation.value.phase === 'idle' ||
      runCorrelation.value.phase === 'succeeded'
    )
      stopOfflineGrace()
  }

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

  /** Recorded, not derived: the queue clears a status as soon as it turns terminal. */
  const runState = ref<RunState>('idle')
  watch(
    () => [
      executionStore.getWorkflowStatus(tourWorkflow.value),
      executionErrorStore.hasNodeError || executionErrorStore.hasPromptError
    ],
    ([status, refused], previous) => {
      if (status !== undefined) stopAcceptDeadline()
      // Only an actual transition into `running` starts the wait. This source
      // re-evaluates whenever the `workflowStatus` map is replaced — which
      // `mutateStatus` does for *any* workflow — or whenever an error flag
      // flips. Paths that drop a job without clearing its status leave
      // `running` behind forever (`handleServiceLevelError` is the live one),
      // so an unconditional branch here would re-read that stale value and put
      // the card back on "your result lands right here" after the watcher
      // below has already failed the run.
      if (status === 'running' && previous[0] !== 'running')
        runState.value = 'generating'
      else if (status === 'completed') runState.value = 'succeeded'
      else if (status === 'failed') runState.value = 'failed'
      // A refused run never queues; a stopped one drops its status rather than
      // reporting an outcome. Both end the run, and neither says so.
      else if (refused && runState.value === 'generating')
        runState.value = 'failed'
      else if (status === undefined && previous[0] === 'running')
        runState.value = 'failed'
    }
  )

  /**
   * The queue stores a job the moment it accepts a submission, so a job
   * carrying this tour's workflow is proof of acceptance. A refused submission
   * never gets one.
   *
   * Deliberately *not* the workflow status: that is only written by
   * `handleExecutionStart`, and a cloud job sits accepted in
   * `initializingJobIds` — "Waiting for a machine" — with no status at all
   * while a worker is allocated. Allocation routinely outlasts any deadline
   * short enough to be useful, so keying on status would fail healthy runs.
   */
  const acceptedTourJobId = computed(() => {
    const correlation = runCorrelation.value
    if (correlation.phase !== 'pending') return null
    return (
      Object.entries(executionStore.queuedJobs).find(
        ([jobId, job]) =>
          !correlation.previousJobIds.has(jobId) &&
          job.workflow === correlation.workflow
      )?.[0] ?? null
    )
  })
  const tourRunPresent = computed(() => {
    const correlation = runCorrelation.value
    return (
      correlation.phase === 'accepted' &&
      executionStore.queuedJobs[correlation.jobId]?.workflow ===
        correlation.workflow
    )
  })

  watch(
    acceptedTourJobId,
    (jobId) => {
      if (jobId) dispatchRunCorrelation({ type: 'accepted', jobId })
    },
    { flush: 'sync' }
  )

  /**
   * A submission the backend refuses never gets a prompt_id, so no status ever
   * appears and none of the branches above can fire. Account preconditions —
   * sign-in, subscription, credits — are deliberately kept out of the error
   * stores by `ComfyApp.queuePrompt`, so the refusal is invisible there too.
   *
   * Give *acceptance* a deadline, not the run. Acceptance arrives on the
   * queuePrompt response rather than the socket, so this cannot pre-empt the
   * longer offline grace: a run accepted at all disarms this immediately and
   * leaves the connection question to `OFFLINE_GRACE_MS`.
   *
   * Acceptance is not the only disarm. `resetExecutionState` drops a job from
   * `queuedJobs` without clearing its status, so a run can report a status
   * while this reads false. A refusal produces neither signal.
   *
   * Losing acceptance is itself a signal, not a re-armed deadline. Two paths
   * drop the job without ever writing an outcome:
   *
   * - an accepted job that disappears with **no status written at all** — the
   *   cloud "waiting for a machine" job that is cancelled or reconciled away
   * - `handleServiceLevelError` ("Job has stagnated"), which drops the job and
   *   records a prompt error but never touches `workflowStatus`, so the
   *   `running` written by `handleExecutionStart` outlives the run
   *
   * Not the mid-run credits path: #15161 made
   * `handleAccountPreconditionError` clear the status, so that one already
   * ends via the `undefined`-after-`running` branch above.
   *
   * A finished run leaves the queue too, but reports a terminal status in the
   * same flush, and the terminal branches above overwrite unconditionally — so
   * the outcome wins whichever watcher runs first.
   */
  watch(
    tourRunPresent,
    (present, wasPresent) => {
      if (present) stopAcceptDeadline()
      else if (wasPresent && runCorrelation.value.phase === 'accepted') {
        dispatchRunCorrelation({ type: 'released' })
        if (runState.value === 'generating') runState.value = 'failed'
      }
    },
    { flush: 'sync' }
  )

  let acceptTimer: ReturnType<typeof setTimeout> | undefined
  function stopAcceptDeadline() {
    clearTimeout(acceptTimer)
    acceptTimer = undefined
  }
  function startAcceptDeadline() {
    stopAcceptDeadline()
    acceptTimer = setTimeout(() => {
      stopAcceptDeadline()
      dispatchRunCorrelation({ type: 'released' })
      if (runState.value === 'generating') runState.value = 'failed'
    }, ACCEPT_DEADLINE_MS)
  }

  let offlineTimer: ReturnType<typeof setTimeout> | undefined
  function stopOfflineGrace() {
    clearTimeout(offlineTimer)
    offlineTimer = undefined
  }
  useEventListener(api, 'reconnecting', () => {
    if (
      (runState.value !== 'generating' &&
        (runCorrelation.value.phase === 'idle' ||
          runCorrelation.value.phase === 'succeeded')) ||
      offlineTimer
    )
      return
    offlineTimer = setTimeout(() => {
      stopOfflineGrace()
      dispatchRunCorrelation({ type: 'released' })
      if (runState.value === 'generating') runState.value = 'failed'
    }, OFFLINE_GRACE_MS)
  })
  useEventListener(api, 'reconnected', stopOfflineGrace)

  onScopeDispose(() => {
    stopAcceptDeadline()
    stopOfflineGrace()
  })

  useEventListener(
    api,
    'execution_success',
    (event) => {
      const { detail } = event as CustomEvent<ExecutionSuccessWsMessage>
      dispatchRunCorrelation({
        type: 'succeeded',
        jobId: detail.prompt_id,
        completedAt: Date.now()
      })
    },
    { capture: true }
  )

  /** A preview's temp file still seeds; the saved result behind it is better. */
  const awaitingSavedOutput = computed(
    () => firstRunOutput.value === null || firstRunOutput.value.type === 'temp'
  )

  useEventListener(api, 'executed', (event) => {
    const { detail } = event as CustomEvent<ExecutedWsMessage>
    if (runCorrelation.value.phase === 'idle' || !awaitingSavedOutput.value)
      return
    // Every media key, not just `images`: a template can save under `video` or
    // under a key only its custom node knows, and only the item itself says
    // whether what came back is an image the continuations can be seeded with.
    const images = parseNodeOutput(detail.node, detail.output).filter(
      isImageResult
    )
    const image = images.find(({ type }) => type !== 'temp') ?? images.at(0)
    if (!image) return
    const parsedType = resultItemType.safeParse(image.type)
    const output: ResultItem = {
      filename: image.filename,
      subfolder: image.subfolder,
      type: parsedType.success ? parsedType.data : 'output'
    }
    dispatchRunCorrelation({
      type: 'output-received',
      jobId: detail.prompt_id,
      output
    })
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

      if (tourWorkflow.value) {
        dispatchRunCorrelation({
          type: 'submitted',
          workflow: tourWorkflow.value,
          previousJobIds: new Set(Object.keys(executionStore.queuedJobs))
        })
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
      nudgeArmed.value = true
      releaseFirstRunTargets()
      runState.value = 'idle'
      tourWorkflow.value = null
    }
  )

  function dismissNudge() {
    nudgeArmed.value = false
    dispatchRunCorrelation({ type: 'released' })
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
    runState.value = 'idle'
    nudgeArmed.value = false
    dispatchRunCorrelation({ type: 'reset' })
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
