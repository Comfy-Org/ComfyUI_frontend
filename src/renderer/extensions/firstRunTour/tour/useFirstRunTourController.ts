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

/** How long a submitted run has to be accepted before the card stops promising. */
const ACCEPT_DEADLINE_MS = 15_000

type TourStartState =
  | { phase: 'idle' }
  | {
      phase: 'claimed'
      ownership: symbol
      restoreRenderer: boolean
    }
  | {
      phase: 'writingRenderer'
      ownership: symbol
      restoreRenderer: boolean
      write: Promise<void>
    }
  | {
      phase: 'previewing'
      ownership: symbol
      restoreRenderer: boolean
    }

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
  let tourStart: TourStartState = { phase: 'idle' }
  /** Only a tour walked to the end made a first result to be congratulated for. */
  const tourWasCompleted = ref(false)

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
  const tourRunAccepted = computed(() =>
    Object.values(executionStore.queuedJobs).some(
      (job) => job.workflow === tourWorkflow.value
    )
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
  watch(tourRunAccepted, (accepted) => {
    if (accepted) stopAcceptDeadline()
    else if (runState.value === 'generating') runState.value = 'failed'
  })

  let acceptTimer: ReturnType<typeof setTimeout> | undefined
  function stopAcceptDeadline() {
    clearTimeout(acceptTimer)
    acceptTimer = undefined
  }
  function startAcceptDeadline() {
    stopAcceptDeadline()
    if (tourRunAccepted.value) return
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
      // Every ending leaves the user somewhere to go next, so every ending arms
      // the nudge; only what it says depends on how the tour ended.
      const ending = engine.lastEnding
      tourWasCompleted.value =
        ending?.tour === 'firstRun' && ending.outcome === 'completed'
      nudgeArmed.value = true
      stopOfflineGrace()
      stopAcceptDeadline()
      releaseFirstRunTargets()
      tourWorkflow.value = null
      runState.value = 'idle'
    }
  )

  function dismissNudge() {
    nudgeArmed.value = false
  }

  function ownsTourStart(ownership: symbol): boolean {
    return tourStart.phase !== 'idle' && tourStart.ownership === ownership
  }

  function releaseTourStart(ownership: symbol): void {
    if (ownsTourStart(ownership)) tourStart = { phase: 'idle' }
  }

  async function writeRenderer(
    ownership: symbol,
    enabled: boolean,
    restoreRenderer: boolean
  ): Promise<void> {
    const write = settingStore.set('Comfy.VueNodes.Enabled', enabled)
    const writingState: TourStartState = {
      phase: 'writingRenderer',
      ownership,
      restoreRenderer,
      write
    }
    tourStart = writingState
    try {
      await write
    } finally {
      if (tourStart === writingState) {
        tourStart = { phase: 'claimed', ownership, restoreRenderer }
      }
    }
  }

  async function cleanUpFailedTourStart(
    ownership: symbol,
    shouldCancel: () => boolean
  ) {
    const currentStart = tourStart
    if (currentStart.phase === 'idle' || currentStart.ownership !== ownership)
      return
    releaseFirstRunTargets()
    tourWorkflow.value = null
    const { restoreRenderer } = currentStart
    if (restoreRenderer && shouldCancel()) return
    if (restoreRenderer) await writeRenderer(ownership, false, restoreRenderer)
    releaseTourStart(ownership)
  }

  function canBeginTour(shouldCancel: () => boolean): boolean {
    return !shouldCancel() && !engine.activeTour && canvasContextHolds.value
  }

  async function claimTourStart(ownership: symbol): Promise<boolean> {
    const previousStart = tourStart
    const restoreRenderer =
      previousStart.phase === 'idle'
        ? !settingStore.get('Comfy.VueNodes.Enabled')
        : previousStart.restoreRenderer

    if (previousStart.phase === 'writingRenderer') {
      tourStart = { ...previousStart, ownership }
      await previousStart.write.catch(() => undefined)
      if (ownsTourStart(ownership))
        tourStart = { phase: 'claimed', ownership, restoreRenderer }
    } else {
      tourStart = { phase: 'claimed', ownership, restoreRenderer }
    }
    return restoreRenderer
  }

  async function claimRendererForTour(ownership: symbol): Promise<boolean> {
    const restoreRenderer = await claimTourStart(ownership)
    if (!ownsTourStart(ownership)) return restoreRenderer
    if (restoreRenderer && !settingStore.get('Comfy.VueNodes.Enabled'))
      await writeRenderer(ownership, true, restoreRenderer)
    return restoreRenderer
  }

  async function cancelPendingStart(): Promise<void> {
    const previousStart = tourStart
    if (previousStart.phase === 'idle') return
    const ownership = Symbol('cancelled-first-run-tour-start')
    try {
      const restoreRenderer = await claimTourStart(ownership)
      if (
        ownsTourStart(ownership) &&
        restoreRenderer &&
        settingStore.get('Comfy.VueNodes.Enabled')
      )
        await writeRenderer(ownership, false, restoreRenderer)
    } finally {
      releaseTourStart(ownership)
    }
  }

  /** False when there is no tour to give; any renderer switch is undone. */
  async function beginTour(
    templateId?: string,
    shouldCancel: () => boolean = () => false
  ): Promise<boolean> {
    const ownership = Symbol('first-run-tour-start')
    // Holds only ever end a tour that is already running, and only when they
    // change — a context lost before the tour opens (`?template=X&mode=linear`
    // boots straight into linear mode) never produces that change. Refused
    // here, ahead of the renderer switch below, so nothing is left to undo.
    if (!canBeginTour(shouldCancel)) return false

    const restoreRenderer = await claimRendererForTour(ownership)
    if (!ownsTourStart(ownership) || shouldCancel()) return false

    tourStart = { phase: 'previewing', ownership, restoreRenderer }
    tourWorkflow.value = workflowStore.activeWorkflow ?? null
    runState.value = 'idle'
    nudgeArmed.value = false
    registerTour(
      'firstRun',
      () => firstRunTourSteps(templateId, runState),
      tourContextHolds
    )
    await delay(INTRO_PREVIEW_MS)
    // The preview is long enough for the canvas to go away underneath it, and
    // the holds watcher cannot catch that: there is no active tour to end yet.
    const contextStillHolds = (): boolean => canvasContextHolds.value
    const started =
      ownsTourStart(ownership) &&
      contextStillHolds() &&
      !shouldCancel() &&
      (await engine.startTour('firstRun'))
    if (!started) {
      await cleanUpFailedTourStart(ownership, shouldCancel)
    } else releaseTourStart(ownership)
    return started
  }

  return {
    beginTour,
    cancelPendingStart,
    nudgeArmed: readonly(nudgeArmed),
    tourWasCompleted: readonly(tourWasCompleted),
    dismissNudge
  }
}

export const useFirstRunTourController = createSharedComposable(
  useFirstRunTourControllerInternal
)
