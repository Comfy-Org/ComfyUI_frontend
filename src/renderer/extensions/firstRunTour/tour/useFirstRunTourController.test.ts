import type { DetachedWindowAPI } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import type { TourEnding } from '@/platform/onboarding/onboardingTourStore'
import type {
  CoachStep,
  SpotlightStep
} from '@/platform/onboarding/onboardingTours'
import type { OnboardingTourSkipReason } from '@/platform/telemetry/types'

const TOUR_WORKFLOW = { path: 'tour.json' }
const OTHER_WORKFLOW = { path: 'other.json' }
const INTRO_PREVIEW_MS = 500
const OFFLINE_GRACE_MS = 20_000
const ACCEPT_DEADLINE_MS = 15_000

const mocks = vi.hoisted(() => ({
  canRunWorkflows: { value: true },
  showSubscriptionDialog: vi.fn(),
  workflowStatus: { value: new Map<unknown, string>() },
  executionErrors: { hasNodeError: false, hasPromptError: false },
  activeWorkflow: { value: null as unknown },
  queuedJobs: { value: {} as Record<string, { workflow?: unknown }> },
  linearMode: { value: false },
  vueNodesEnabled: true,
  setSetting: vi.fn(),
  steps: [] as CoachStep[],
  runState: { value: 'idle' } as Ref<string>,
  releaseFirstRunTargets: vi.fn(),
  engine: {
    activeTour: null as string | null,
    lastEnding: null as TourEnding | null,
    step: null as CoachStep | null,
    isLast: false,
    startTour: vi.fn(),
    next: vi.fn(),
    skip: vi.fn(),
    postpone: vi.fn()
  }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canRunWorkflows: mocks.canRunWorkflows,
    showSubscriptionDialog: mocks.showSubscriptionDialog
  })
}))

// Each factory runs on the first dynamic import, which lands mid-test for
// whichever test runs first. Seed the new ref from the holder so that test's
// setup survives instead of being discarded.
vi.mock('@/stores/executionStore', async () => {
  const { shallowRef } = await import('vue')
  mocks.workflowStatus = shallowRef(new Map(mocks.workflowStatus.value))
  mocks.queuedJobs = shallowRef(mocks.queuedJobs.value)
  return {
    useExecutionStore: () => ({
      getWorkflowStatus: (workflow: unknown) =>
        mocks.workflowStatus.value.get(workflow),
      get queuedJobs() {
        return mocks.queuedJobs.value
      }
    })
  }
})

vi.mock('@/stores/executionErrorStore', async () => {
  const { reactive } = await import('vue')
  mocks.executionErrors = reactive({ ...mocks.executionErrors })
  return { useExecutionErrorStore: () => mocks.executionErrors }
})

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { shallowRef } = await import('vue')
  mocks.activeWorkflow = shallowRef(mocks.activeWorkflow.value)
  return {
    useWorkflowStore: () => ({
      get activeWorkflow() {
        return mocks.activeWorkflow.value
      }
    })
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', async () => {
  const { shallowRef } = await import('vue')
  mocks.linearMode = shallowRef(mocks.linearMode.value)
  return {
    useCanvasStore: () => ({
      get linearMode() {
        return mocks.linearMode.value
      }
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => mocks.vueNodesEnabled,
    // A spy, not a plain writer: a value that was flipped and put back reads
    // the same as one that was never touched.
    set: mocks.setSetting
  })
}))

vi.mock('./firstRunTourDefinition', () => ({
  firstRunTourSteps: (_templateId: string, runState: Ref<string>) => {
    mocks.runState = runState
    return Promise.resolve(mocks.steps)
  },
  releaseFirstRunTargets: mocks.releaseFirstRunTargets
}))

vi.mock('@/platform/onboarding/onboardingTourStore', async () => {
  const { reactive } = await import('vue')
  mocks.engine = reactive(mocks.engine)
  return { useOnboardingTourStore: () => mocks.engine }
})

function runStep(): SpotlightStep {
  return {
    kind: 'spotlight',
    name: 'run',
    placement: 'bottom',
    selfAdvancing: true
  }
}

let controllerScope: EffectScope | undefined
let resolveRegisteredTour: () => Promise<unknown>
let registeredTourHolds: () => boolean

/** Scoped so each controller's document listener dies with its test. */
async function freshController() {
  controllerScope?.stop()
  vi.resetModules()
  controllerScope = effectScope()
  const tours = await import('@/platform/onboarding/onboardingTours')
  resolveRegisteredTour = async () => {
    const definition = tours.tourDefinition('firstRun')
    return Array.isArray(definition) ? definition : definition?.()
  }
  registeredTourHolds = () => tours.tourHolds('firstRun')
  const { useFirstRunTourController } =
    await import('./useFirstRunTourController')
  return controllerScope.run(() => useFirstRunTourController())!
}

/** A started tour sitting on its Run step, the state every run outcome acts on. */
async function tourOnRunStep() {
  mocks.steps = [runStep()]
  mocks.activeWorkflow.value = TOUR_WORKFLOW
  mocks.engine.startTour.mockImplementation(async () => {
    await resolveRegisteredTour()
    mocks.engine.activeTour = 'firstRun'
    mocks.engine.step = runStep()
    return true
  })
  const controller = await freshController()

  const starting = controller.beginTour('image_z_image_turbo')
  await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)

  return { controller, started: await starting }
}

/** The engine ending the tour and recording how, the way `finish()` leaves it. */
function endTour(ending: TourEnding) {
  mocks.engine.lastEnding = ending
  mocks.engine.activeTour = null
  mocks.engine.step = null
  return nextTick()
}

const COMPLETED: TourEnding = { tour: 'firstRun', outcome: 'completed' }

function skippedBecause(skipReason: OnboardingTourSkipReason): TourEnding {
  return { tour: 'firstRun', outcome: 'skipped', skipReason }
}

/** Every ending short of walking the tour to the end. */
const UNFINISHED_ENDINGS: { named: string; ending: TourEnding }[] = [
  { named: 'the user waved away on step 1', ending: skippedBecause('user') },
  {
    named: 'a missing target tore down',
    ending: skippedBecause('target_timeout')
  },
  { named: 'the paywall parked', ending: skippedBecause('postponed') },
  { named: 'a lost context ended', ending: skippedBecause('trigger_lost') }
]

/** The queue storing a job, which is what acceptance actually looks like. */
function acceptRun(workflow: unknown, jobId = 'job-1') {
  mocks.queuedJobs.value = {
    ...mocks.queuedJobs.value,
    [jobId]: { workflow }
  }
  return nextTick()
}

/** The queue letting a job go, which `resetExecutionState` does silently. */
function removeRun() {
  mocks.queuedJobs.value = {}
  return nextTick()
}

function acceptThenRemoveRun(workflow: unknown, jobId = 'job-1') {
  mocks.queuedJobs.value = {
    ...mocks.queuedJobs.value,
    [jobId]: { workflow }
  }
  mocks.queuedJobs.value = {}
  return nextTick()
}

function finishRun(workflow: unknown, status: string) {
  mocks.workflowStatus.value = new Map(mocks.workflowStatus.value).set(
    workflow,
    status
  )
  return nextTick()
}

async function captureFirstImage(promptId = 'tour-job') {
  await acceptRun(TOUR_WORKFLOW, promptId)
  const { api } = await import('@/scripts/api')
  api.dispatchCustomEvent('execution_start', {
    prompt_id: promptId,
    timestamp: 1
  })
  api.dispatchCustomEvent('executed', {
    prompt_id: promptId,
    node: 1,
    display_node: 1,
    output: {
      images: [
        {
          filename: 'first-output.png',
          subfolder: 'tour',
          type: 'output'
        }
      ]
    }
  })
  await nextTick()
}

/** A user stop, which drops the status instead of reporting an outcome. */
function dropRun(workflow: unknown) {
  const next = new Map(mocks.workflowStatus.value)
  next.delete(workflow)
  mocks.workflowStatus.value = next
  return nextTick()
}

function setViewportWidth(width: number) {
  const happyDOM = (window as unknown as { happyDOM?: DetachedWindowAPI })
    .happyDOM
  if (!happyDOM)
    throw new Error('window.happyDOM is unavailable to set viewport')
  happyDOM.setViewport({ width })
  window.dispatchEvent(new Event('resize'))
}

function mountRunButton(
  testId: 'queue-button' | 'subscribe-to-run-button',
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement('button')
  button.dataset.testid = testId
  button.addEventListener('click', onClick)
  document.body.appendChild(button)
  return button
}

describe('useFirstRunTourController', () => {
  beforeEach(() => {
    mocks.canRunWorkflows = ref(true)
    mocks.workflowStatus.value = new Map()
    mocks.queuedJobs.value = {}
    mocks.executionErrors.hasNodeError = false
    mocks.executionErrors.hasPromptError = false
    mocks.activeWorkflow.value = null
    mocks.linearMode.value = false
    mocks.vueNodesEnabled = true
    mocks.setSetting.mockImplementation((_key: string, value: boolean) => {
      mocks.vueNodesEnabled = value
      return Promise.resolve()
    })
    mocks.steps = []
    mocks.engine.activeTour = null
    mocks.engine.lastEnding = null
    mocks.engine.step = null
    mocks.engine.isLast = false
  })

  afterEach(() => {
    controllerScope?.stop()
    controllerScope = undefined
    setViewportWidth(1280)
  })

  describe('starting', () => {
    it('turns on the renderer whose nodes it spotlights', async () => {
      mocks.vueNodesEnabled = false
      mocks.steps = [runStep()]
      mocks.engine.startTour.mockResolvedValue(true)
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting

      expect(
        mocks.vueNodesEnabled,
        'a new user has no installed version, so Nodes 2.0 reads off and every step is blind'
      ).toBe(true)
    })

    it('hands back the renderer when the engine turns the start down', async () => {
      mocks.vueNodesEnabled = false
      mocks.steps = [runStep()]
      mocks.engine.startTour.mockResolvedValue(false)
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting

      expect(
        mocks.vueNodesEnabled,
        'a user who got no tour must not be left migrated by the one that never ran'
      ).toBe(false)
    })

    it('leaves a renderer the user already had switched on', async () => {
      mocks.vueNodesEnabled = true
      mocks.steps = [runStep()]
      mocks.engine.startTour.mockResolvedValue(false)
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting

      expect(
        mocks.vueNodesEnabled,
        'the tour only undoes the switch it threw itself'
      ).toBe(true)
    })

    it('starts nothing over a tour that is already running', async () => {
      mocks.engine.activeTour = 'appMode'
      mocks.steps = [runStep()]
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)

      expect(
        await starting,
        'the engine would refuse it anyway, so the side effects must not fire either'
      ).toBe(false)
      expect(mocks.engine.startTour).not.toHaveBeenCalled()
      expect(mocks.vueNodesEnabled).toBe(true)
    })

    // Holds only ever end a tour that is already running, and only when they
    // change, so a context that is lost before the tour opens has to be
    // refused at the door. Asserted as "nothing opened" rather than as the
    // holds value: with no tour registered there is nothing to hold.
    it('refuses to open over the linear view, which hides the canvas', async () => {
      mocks.linearMode.value = true
      mocks.vueNodesEnabled = false
      mocks.steps = [runStep()]
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)

      expect(
        await starting,
        '?template=X&mode=linear display:none-s the canvas, so every card would point at a node nobody can see'
      ).toBe(false)
      expect(
        mocks.engine.startTour,
        'the cards would sit over a hidden canvas until their targets timed out'
      ).not.toHaveBeenCalled()
      expect(
        mocks.setSetting,
        'a tour that never opened must not touch the renderer setting at all'
      ).not.toHaveBeenCalledWith('Comfy.VueNodes.Enabled', true)
    })

    it('refuses to open on a viewport below the desktop layout', async () => {
      setViewportWidth(500)
      mocks.vueNodesEnabled = false
      mocks.steps = [runStep()]
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)

      expect(
        await starting,
        'the spotlights are placed against a desktop layout, so below md they point nowhere'
      ).toBe(false)
      expect(mocks.engine.startTour).not.toHaveBeenCalled()
      expect(mocks.setSetting).not.toHaveBeenCalledWith(
        'Comfy.VueNodes.Enabled',
        true
      )
    })

    it('refuses to open when the canvas goes away during the intro preview', async () => {
      mocks.vueNodesEnabled = false
      mocks.steps = [runStep()]
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      // Flush the renderer switch first, so the canvas is lost inside the
      // preview delay rather than while beginTour is still setting up. Only
      // the post-delay re-check can catch it from there.
      await vi.advanceTimersByTimeAsync(0)
      mocks.linearMode.value = true
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)

      expect(
        await starting,
        'the holds watcher cannot catch this — there is no active tour to end yet'
      ).toBe(false)
      expect(mocks.engine.startTour).not.toHaveBeenCalled()
      expect(
        mocks.vueNodesEnabled,
        'the renderer switch thrown for a tour that never opened is handed back'
      ).toBe(false)
    })

    it('leaves the workflow undimmed before taking the screen over', async () => {
      mocks.steps = [runStep()]
      const controller = await freshController()
      void controller.beginTour('image_z_image_turbo')

      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS - 1)
      expect(
        mocks.engine.startTour,
        'a user who just picked a template deserves a look at it before the scrim'
      ).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(mocks.engine.startTour).toHaveBeenCalledWith('firstRun')
    })

    it('hands back the canvas targets when the engine turns the start down', async () => {
      mocks.steps = [runStep()]
      mocks.engine.startTour.mockImplementation(async () => {
        await resolveRegisteredTour()
        return false
      })
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting

      expect(
        mocks.releaseFirstRunTargets,
        'resolving the steps registered them, and no tour will end to release them'
      ).toHaveBeenCalled()
    })
  })

  describe('a run behind a dropped socket', () => {
    /**
     * A run the queue accepted: the click reports `generating`, then the
     * backend answers with a status. The acknowledgement matters — an
     * unacknowledged submission is a refusal, and is covered separately below.
     */
    async function generatingRun() {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      expect(mocks.runState.value).toBe('generating')
      await finishRun(TOUR_WORKFLOW, 'running')
      const { api } = await import('@/scripts/api')
      return api
    }

    it('stops promising a result the queue never accepted', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      expect(mocks.runState.value).toBe('generating')

      // No status ever arrives. A refused submission gets no prompt_id, and
      // account preconditions - sign-in, subscription, credits - are kept out
      // of the error stores on purpose, so nothing else can report this.
      await vi.advanceTimersByTimeAsync(ACCEPT_DEADLINE_MS)

      expect(
        mocks.runState.value,
        'a paid user out of credits is refused silently; the card must not promise a result forever'
      ).toBe('failed')
    })

    it('leaves a run accepted but still waiting for a machine alone', async () => {
      // Cloud accepts the job and reports "Waiting for a machine" — it is in
      // `initializingJobIds` with NO workflow status until a worker picks it
      // up, which routinely outlasts the deadline. Keying on status instead of
      // acceptance would fail this healthy run and tell the user to run again,
      // prompting a duplicate paid submission.
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)

      await vi.advanceTimersByTimeAsync(ACCEPT_DEADLINE_MS * 4)

      expect(
        mocks.runState.value,
        'an accepted job with no status yet is queued, not refused'
      ).toBe('generating')
    })

    it('lets the offline grace outlive the acceptance deadline', async () => {
      // The grace is 20s and the acceptance deadline 15s. A drop before the
      // first status must still get the full grace: acceptance arrives on the
      // queuePrompt response, not the socket, so it disarms this deadline even
      // while the connection is down.
      const { api } = await import('@/scripts/api')
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)

      api.dispatchCustomEvent('reconnecting')
      await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS - 1)

      expect(
        mocks.runState.value,
        'the 15s acceptance deadline must not cut the 20s grace short'
      ).toBe('generating')
    })

    it('leaves an accepted run past the acceptance deadline alone', async () => {
      await generatingRun()

      await vi.advanceTimersByTimeAsync(ACCEPT_DEADLINE_MS * 4)

      expect(
        mocks.runState.value,
        'the deadline is on acceptance, not on the run: a job that answered must never be cut short'
      ).toBe('generating')
    })

    it('stops promising a result once the socket stays gone', async () => {
      const api = await generatingRun()

      api.dispatchCustomEvent('reconnecting')
      await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS)

      expect(
        mocks.runState.value,
        'nothing reports a run whose socket never came back, so the card waits forever'
      ).toBe('failed')
    })

    it('keeps waiting when the socket comes back', async () => {
      const api = await generatingRun()

      api.dispatchCustomEvent('reconnecting')
      await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS / 2)
      api.dispatchCustomEvent('reconnected')
      await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS)

      expect(
        mocks.runState.value,
        'a blink of connection loss must not fail a run that is still going'
      ).toBe('generating')
    })

    it('leaves a run that is still reporting alone', async () => {
      await generatingRun()

      await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS * 3)

      expect(
        mocks.runState.value,
        'video takes minutes; a timer that does not need the socket to drop fails healthy runs'
      ).toBe('generating')
    })

    it('lets a recovered socket cancel every retry that preceded it', async () => {
      const api = await generatingRun()

      // Only the first retry may own the deadline, or reconnecting leaves
      // timers behind that no single `reconnected` can clear.
      for (let attempt = 0; attempt < 3; attempt++) {
        api.dispatchCustomEvent('reconnecting')
        await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS / 4)
      }
      api.dispatchCustomEvent('reconnected')
      await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS * 2)

      expect(
        mocks.runState.value,
        'a run that came back must not be failed by a timer an earlier retry armed'
      ).toBe('generating')
    })

    it('keeps a run that landed while the socket was gone', async () => {
      const api = await generatingRun()

      api.dispatchCustomEvent('reconnecting')
      await finishRun(TOUR_WORKFLOW, 'completed')
      await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS)

      expect(
        mocks.runState.value,
        'the grace timer must not clobber an outcome that arrived before it fired'
      ).toBe('succeeded')
    })

    it('stops promising a result once the queue lets go of its job', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)

      await removeRun()

      expect(
        mocks.runState.value,
        'an accepted job that leaves without an outcome leaves the card waiting on a result nobody will send'
      ).toBe('failed')
    })

    it('stops when accepted job metadata is removed in the same tick', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()

      await acceptThenRemoveRun(TOUR_WORKFLOW)

      expect(mocks.runState.value).toBe('failed')
    })

    it('stops promising a result when a running job is dropped mid-run', async () => {
      // `handleServiceLevelError` ("Job has stagnated") is the live path: it
      // drops the job and records a prompt error but never touches
      // `workflowStatus`, so the `running` from `handleExecutionStart`
      // outlives the run and no status change reports the end.
      //
      // Deliberately not the mid-run credits path — #15161 made
      // `handleAccountPreconditionError` clear the status, so that one ends
      // via the `undefined`-after-`running` branch without this watcher.
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)
      await finishRun(TOUR_WORKFLOW, 'running')

      await removeRun()

      expect(
        mocks.runState.value,
        'a run cut short for credits keeps its running status, so losing the job is the only signal left'
      ).toBe('failed')
    })

    it('keeps a completed run that drops out of the queue as it finishes', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)

      // `handleExecutionSuccess` reports the outcome and drops the job in one
      // tick, so both land before either watcher runs.
      void finishRun(TOUR_WORKFLOW, 'completed')
      await removeRun()

      expect(
        mocks.runState.value,
        'every healthy run leaves the queue when it finishes; failing those would fail every run'
      ).toBe('succeeded')
    })

    it('keeps a failed run that leaves the queue after reporting', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)
      await finishRun(TOUR_WORKFLOW, 'failed')

      await removeRun()

      expect(
        mocks.runState.value,
        'a reported outcome is the last word; losing the job afterwards says nothing new'
      ).toBe('failed')
    })

    // Pins the transition gate on the status watcher. The stagnation path
    // leaves `running` in `workflowStatus` forever, and that source
    // re-evaluates whenever the map is replaced for *any* workflow. Without
    // the gate the stale `running` is re-read and the card goes back to
    // promising a result it has already given up on.
    it('stays failed when an unrelated workflow churns the status map', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)
      await finishRun(TOUR_WORKFLOW, 'running')

      await removeRun()
      expect(mocks.runState.value).toBe('failed')

      await finishRun(OTHER_WORKFLOW, 'running')

      expect(
        mocks.runState.value,
        'another workflow starting is not this run coming back from the dead'
      ).toBe('failed')
    })

    // The other half of the stagnation path: the prompt error it records must
    // still be able to end the run while the stale `running` sits there.
    it('gives up on a stagnated job that leaves an error and a stale status', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW)
      await finishRun(TOUR_WORKFLOW, 'running')

      mocks.executionErrors.hasPromptError = true
      await removeRun()

      expect(
        mocks.runState.value,
        'a stagnated run reports an error and abandons the job; the status it leaves behind is not news'
      ).toBe('failed')
    })
  })

  describe('run outcome', () => {
    it('moves on with the Run click rather than waiting out the run', async () => {
      await tourOnRunStep()

      mountRunButton('queue-button', () => {}).click()

      expect(
        mocks.engine.next,
        'a run takes minutes; a tour parked on a button the user already pressed reads as broken'
      ).toHaveBeenCalled()
      expect(mocks.runState.value).toBe('generating')
    })

    it('hands the last step to the engine like any other', async () => {
      await tourOnRunStep()
      mocks.engine.isLast = true

      mountRunButton('queue-button', () => {}).click()

      expect(
        mocks.engine.next,
        'ending a tour is the engine’s call; the button only reports the click'
      ).toHaveBeenCalled()
    })

    it('ends the tour when the user swaps to a workflow its ids do not describe', async () => {
      await tourOnRunStep()
      expect(registeredTourHolds()).toBe(true)

      mocks.activeWorkflow.value = OTHER_WORKFLOW
      await nextTick()

      expect(
        registeredTourHolds(),
        'node ids are graph-local, so the tour points at strangers now'
      ).toBe(false)
    })

    it('keeps the tour running while its own workflow stays active', async () => {
      await tourOnRunStep()

      await finishRun(TOUR_WORKFLOW, 'running')

      expect(
        registeredTourHolds(),
        'a tour must not end just because its run progressed'
      ).toBe(true)
    })

    it('ends the tour when the user switches into the linear view mid-walk', async () => {
      await tourOnRunStep()
      expect(registeredTourHolds()).toBe(true)

      mocks.linearMode.value = true
      await nextTick()

      expect(
        registeredTourHolds(),
        'the canvas the tour is pointing at goes away the moment linear mode takes over'
      ).toBe(false)
    })

    it('ignores a run that finished for another workflow', async () => {
      await tourOnRunStep()
      mocks.activeWorkflow.value = OTHER_WORKFLOW

      await finishRun(OTHER_WORKFLOW, 'failed')

      expect(
        mocks.runState.value,
        'a job the tour did not start must not speak for the tour'
      ).toBe('idle')
    })

    it('stops promising a result once the user stops the run', async () => {
      await tourOnRunStep()
      await finishRun(TOUR_WORKFLOW, 'running')

      await dropRun(TOUR_WORKFLOW)

      expect(
        mocks.runState.value,
        'a stop drops the status, so the card would promise a result forever'
      ).toBe('failed')
    })

    it('leaves a run it never saw start alone', async () => {
      await tourOnRunStep()

      await dropRun(TOUR_WORKFLOW)

      expect(
        mocks.runState.value,
        'a status that was never running has no outcome to report'
      ).toBe('idle')
    })

    it('says so when the run produced nothing', async () => {
      await tourOnRunStep()

      await finishRun(TOUR_WORKFLOW, 'failed')

      expect(
        mocks.runState.value,
        'announcing a result that does not exist is the bug D2 filed'
      ).toBe('failed')
    })

    it('reports a run still in flight', async () => {
      await tourOnRunStep()

      await finishRun(TOUR_WORKFLOW, 'running')

      expect(mocks.runState.value).toBe('generating')
    })

    it('hands the next tour a run state of its own', async () => {
      await tourOnRunStep()
      await finishRun(TOUR_WORKFLOW, 'completed')
      expect(mocks.runState.value).toBe('succeeded')

      mocks.engine.activeTour = null
      await nextTick()

      expect(
        mocks.runState.value,
        'inheriting the last outcome opens the next Result step already reporting'
      ).toBe('idle')
    })

    it('remembers a run that landed after the queue drops its status', async () => {
      await tourOnRunStep()
      await finishRun(TOUR_WORKFLOW, 'running')
      await finishRun(TOUR_WORKFLOW, 'completed')

      mocks.workflowStatus.value = new Map()
      await nextTick()

      expect(
        mocks.runState.value,
        'the tab clears a terminal status, and the Result step still has to report it'
      ).toBe('succeeded')
    })

    it('tells a run that landed apart from one that never started', async () => {
      await tourOnRunStep()
      await finishRun(TOUR_WORKFLOW, 'running')

      await finishRun(TOUR_WORKFLOW, 'completed')

      expect(
        mocks.runState.value,
        'sharing a state with never-ran leaves the Result step unable to tell them apart'
      ).toBe('succeeded')
    })

    it('gives up on a run the queue refused', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()

      mocks.executionErrors.hasNodeError = true
      await nextTick()

      expect(
        mocks.runState.value,
        'a refused prompt never executes, so no status will ever end the wait'
      ).toBe('failed')
    })

    it('gives up on a run the validator refused before it reached a node', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()

      mocks.executionErrors.hasPromptError = true
      await nextTick()

      expect(
        mocks.runState.value,
        'a prompt refused whole never reaches a node, so no node error and no status will ever end the wait'
      ).toBe('failed')
    })

    it('leaves errors alone until the tour has run something', async () => {
      await tourOnRunStep()

      mocks.executionErrors.hasPromptError = true
      await nextTick()

      expect(
        mocks.runState.value,
        'errors already on screen when the tour reaches Run are not its run'
      ).toBe('idle')
    })
  })

  describe('the nudge', () => {
    it('arms after a completed tour produced an image', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await captureFirstImage()

      expect(
        controller.nudgeArmed.value,
        'a nudge fighting a live tour for the screen helps nobody'
      ).toBe(false)

      await endTour(COMPLETED)

      expect(controller.nudgeArmed.value).toBe(true)
      expect(controller.nudgeOutput.value).toEqual({
        filename: 'first-output.png',
        subfolder: 'tour',
        type: 'output'
      })
    })

    it('arms with nothing to continue when the tour produced no image', async () => {
      const { controller } = await tourOnRunStep()

      await endTour(COMPLETED)

      expect(
        controller.nudgeArmed.value,
        'suppressing the nudge takes the way forward from the user who most needs it (#14144)'
      ).toBe(true)
      expect(controller.nudgeOutput.value).toBeNull()
    })

    it.for(UNFINISHED_ENDINGS)(
      'offers the image to continue after a tour $named',
      async ({ ending }) => {
        const { controller } = await tourOnRunStep()
        mountRunButton('queue-button', () => {}).click()
        await captureFirstImage()

        await endTour(ending)

        expect(controller.nudgeArmed.value).toBe(true)
        expect(controller.nudgeOutput.value?.filename).toBe('first-output.png')
      }
    )

    it('keeps correlating a run the user walked past', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW, 'tour-job')

      await endTour(COMPLETED)
      expect(controller.nudgeOutput.value).toBeNull()

      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 1,
        display_node: 1,
        output: { images: [{ filename: 'late.png', type: 'output' }] }
      })
      await nextTick()

      expect(
        controller.nudgeOutput.value?.filename,
        'clicking Done during a long generation must not throw the result away'
      ).toBe('late.png')
    })

    it('continues from a video run through the template browser only', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW, 'tour-job')
      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 1,
        display_node: 1,
        output: { video: [{ filename: 'result.mp4', type: 'output' }] }
      })

      await endTour(COMPLETED)

      expect(controller.nudgeArmed.value).toBe(true)
      expect(
        controller.nudgeOutput.value,
        'no image-input continuation can be seeded from a video'
      ).toBeNull()
    })

    it('takes a preview temp file when nothing saved one', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW, 'tour-job')
      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 1,
        display_node: 1,
        output: { images: [{ filename: 'preview.png', type: 'temp' }] }
      })

      await endTour(COMPLETED)

      expect(
        controller.nudgeOutput.value,
        'a PreviewImage sink is the whole result, and the backend still serves it'
      ).toEqual({ filename: 'preview.png', subfolder: '', type: 'temp' })
    })

    it('replaces a buffered preview when the saved result also beats the queue', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 1,
        display_node: 1,
        output: { images: [{ filename: 'preview.png', type: 'temp' }] }
      })
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 2,
        display_node: 2,
        output: { images: [{ filename: 'saved.png', type: 'output' }] }
      })

      await acceptRun(TOUR_WORKFLOW, 'tour-job')
      await endTour(COMPLETED)

      expect(
        controller.nudgeOutput.value?.filename,
        'a preview that beat the queue metadata must not lock out the saved result'
      ).toBe('saved.png')
    })

    it('replaces a preview output with the saved result', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW, 'tour-job')
      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('execution_start', {
        prompt_id: 'tour-job',
        timestamp: 1
      })
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 1,
        display_node: 1,
        output: { images: [{ filename: 'preview.png', type: 'temp' }] }
      })
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 2,
        display_node: 2,
        output: { images: [{ filename: 'saved.png', type: 'output' }] }
      })

      await endTour(COMPLETED)

      expect(
        controller.nudgeOutput.value?.filename,
        'the saved result is the one the user was shown, so it wins the seed'
      ).toBe('saved.png')
    })

    it('ignores image output from a different job', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await acceptRun(TOUR_WORKFLOW, 'tour-job')
      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('execution_start', {
        prompt_id: 'tour-job',
        timestamp: 1
      })
      api.dispatchCustomEvent('executed', {
        prompt_id: 'other-job',
        node: 1,
        display_node: 1,
        output: {
          images: [{ filename: 'other.png', type: 'output' }]
        }
      })

      await endTour(COMPLETED)

      expect(controller.nudgeOutput.value).toBeNull()
    })

    it('correlates output after an unrelated execution starts first', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('execution_start', {
        prompt_id: 'other-job',
        timestamp: 1
      })
      api.dispatchCustomEvent('executed', {
        prompt_id: 'other-job',
        node: 1,
        display_node: 1,
        output: {
          images: [{ filename: 'other.png', type: 'output' }]
        }
      })
      await nextTick()

      await captureFirstImage()
      await endTour(COMPLETED)

      expect(controller.nudgeOutput.value?.filename).toBe('first-output.png')
    })

    it('captures output that arrives before accepted job metadata', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      const { api } = await import('@/scripts/api')
      api.dispatchCustomEvent('executed', {
        prompt_id: 'tour-job',
        node: 1,
        display_node: 1,
        output: {
          images: [{ filename: 'early.png', type: 'output' }]
        }
      })

      await acceptRun(TOUR_WORKFLOW, 'tour-job')
      await endTour(COMPLETED)

      expect(controller.nudgeOutput.value?.filename).toBe('early.png')
    })

    it('takes an armed nudge off the screen when a second tour starts', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await captureFirstImage()
      await endTour(COMPLETED)
      expect(controller.nudgeArmed.value).toBe(true)

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting

      expect(
        controller.nudgeArmed.value,
        'a nudge left over from the last tour would sit on top of this one'
      ).toBe(false)
    })

    it('offers no continuation when the tour never appeared', async () => {
      mocks.steps = []
      mocks.activeWorkflow.value = TOUR_WORKFLOW
      mocks.engine.startTour.mockImplementation(async () => {
        await resolveRegisteredTour()
        // The store requests the run, resolves no steps and returns to idle, so
        // nothing ever calls `finish()` and no ending is recorded.
        mocks.engine.activeTour = 'firstRun'
        await nextTick()
        mocks.engine.activeTour = null
        return false
      })
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting
      await nextTick()

      expect(
        controller.nudgeArmed.value,
        'a user who saw no tour is the one who most needs somewhere to go next'
      ).toBe(true)
      expect(
        controller.nudgeOutput.value,
        'there is no first output to seed into any suggestion'
      ).toBeNull()
    })

    it('stops offering the nudge once it is waved away', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await captureFirstImage()
      await endTour(COMPLETED)

      controller.dismissNudge()

      expect(
        controller.nudgeArmed.value,
        'nothing re-arms it, so dismissal has to be the end of it'
      ).toBe(false)
    })
  })

  describe('the paywall', () => {
    it('parks the tour on a Run click it cannot fund', async () => {
      await tourOnRunStep()
      mocks.canRunWorkflows.value = false
      const underlyingHandler = vi.fn()
      const click = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      })
      mountRunButton(
        'subscribe-to-run-button',
        underlyingHandler
      ).dispatchEvent(click)

      expect(
        underlyingHandler,
        'the subscribe button opens the paywall itself, with its own reason and telemetry'
      ).toHaveBeenCalled()
      expect(
        mocks.showSubscriptionDialog,
        'opening it here too would replace the button reason with the tour own'
      ).not.toHaveBeenCalled()
      expect(
        mocks.engine.postpone,
        'whoever subscribes off the back of this still has their first run ahead of them'
      ).toHaveBeenCalled()
      expect(mocks.engine.skip).not.toHaveBeenCalled()
      expect(
        mocks.engine.next,
        'nothing was queued, so there is no result to send the user to'
      ).not.toHaveBeenCalled()
    })

    it('keeps parking after the step renames its copy', async () => {
      await tourOnRunStep()
      mocks.engine.step = { ...runStep(), name: 'run.cloud' }
      mocks.canRunWorkflows.value = false
      await nextTick()
      const underlyingHandler = vi.fn()

      mountRunButton('subscribe-to-run-button', underlyingHandler).click()

      expect(
        mocks.engine.next,
        'a translation key is copy, so renaming it must not walk the tour onto a run that never queued'
      ).not.toHaveBeenCalled()
      expect(mocks.engine.postpone).toHaveBeenCalled()
    })

    it('leaves the Run button alone on a step the user can walk past', async () => {
      await tourOnRunStep()
      mocks.engine.step = {
        kind: 'spotlight',
        name: 'result.image',
        placement: 'auto'
      }
      await nextTick()
      const underlyingHandler = vi.fn()

      mountRunButton('queue-button', underlyingHandler).click()

      expect(
        underlyingHandler,
        'only the step whose sole way forward is running may intercept the run'
      ).toHaveBeenCalled()
      expect(mocks.engine.next).not.toHaveBeenCalled()
    })

    it('lets a funded run through untouched', async () => {
      await tourOnRunStep()
      const underlyingHandler = vi.fn()

      mountRunButton('queue-button', underlyingHandler).click()

      expect(underlyingHandler).toHaveBeenCalled()
      expect(mocks.engine.postpone).not.toHaveBeenCalled()
    })

    it('does not walk the tour on for a run it just refused', async () => {
      await tourOnRunStep()
      mocks.canRunWorkflows.value = false

      mountRunButton('subscribe-to-run-button', () => {}).click()

      expect(
        mocks.engine.next,
        'nothing was queued, so there is no result to send the user to'
      ).not.toHaveBeenCalled()
    })

    it('does not end a running tour when funds run out mid-step', async () => {
      await tourOnRunStep()

      mocks.canRunWorkflows.value = false
      await nextTick()

      expect(
        mocks.engine.postpone,
        'the paywall is keyed to the click, so an active tour survives losing eligibility'
      ).not.toHaveBeenCalled()
    })
  })
})
