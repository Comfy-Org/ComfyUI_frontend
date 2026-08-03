import { createTestingPinia } from '@pinia/testing'
import type { DetachedWindowAPI } from 'happy-dom'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import type {
  CoachStep,
  SpotlightStep
} from '@/platform/onboarding/onboardingTours'

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
  vueNodesEnabled: true,
  steps: [] as CoachStep[],
  runState: { value: 'idle' } as Ref<string>,
  releaseFirstRunTargets: vi.fn(),
  engine: {
    activeTour: null as string | null,
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

vi.mock('@/stores/executionStore', async () => {
  const { shallowRef } = await import('vue')
  mocks.workflowStatus = shallowRef(new Map<unknown, string>())
  return {
    useExecutionStore: () => ({
      getWorkflowStatus: (workflow: unknown) =>
        mocks.workflowStatus.value.get(workflow)
    })
  }
})

vi.mock('@/stores/executionErrorStore', async () => {
  const { reactive } = await import('vue')
  mocks.executionErrors = reactive({
    hasNodeError: false,
    hasPromptError: false
  })
  return { useExecutionErrorStore: () => mocks.executionErrors }
})

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { shallowRef } = await import('vue')
  mocks.activeWorkflow = shallowRef(null as unknown)
  return {
    useWorkflowStore: () => ({
      get activeWorkflow() {
        return mocks.activeWorkflow.value
      }
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => mocks.vueNodesEnabled,
    set: (_key: string, value: boolean) => {
      mocks.vueNodesEnabled = value
      return Promise.resolve()
    }
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

function finishRun(workflow: unknown, status: string) {
  mocks.workflowStatus.value = new Map(mocks.workflowStatus.value).set(
    workflow,
    status
  )
  return nextTick()
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
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.canRunWorkflows = ref(true)
    mocks.workflowStatus.value = new Map()
    mocks.executionErrors.hasNodeError = false
    mocks.executionErrors.hasPromptError = false
    mocks.activeWorkflow.value = null
    mocks.vueNodesEnabled = true
    mocks.steps = []
    mocks.engine.activeTour = null
    mocks.engine.step = null
    mocks.engine.isLast = false
  })

  afterEach(() => {
    controllerScope?.stop()
    controllerScope = undefined
    document.body.innerHTML = ''
    setViewportWidth(1280)
    vi.useRealTimers()
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

    it('refuses to hold a tour on a viewport below the desktop layout', async () => {
      setViewportWidth(500)
      await tourOnRunStep()

      expect(
        registeredTourHolds(),
        'the spotlight is placed against a desktop layout, so below md it points nowhere'
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
    it('arms only once the tour is over', async () => {
      const { controller } = await tourOnRunStep()
      expect(
        controller.nudgeArmed.value,
        'a nudge fighting a live tour for the screen helps nobody'
      ).toBe(false)

      mocks.engine.activeTour = null
      await nextTick()

      expect(controller.nudgeArmed.value).toBe(true)
    })

    it('arms whatever the run did', async () => {
      const { controller } = await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      await finishRun(TOUR_WORKFLOW, 'failed')

      mocks.engine.activeTour = null
      await nextTick()

      expect(
        controller.nudgeArmed.value,
        'the user who most needs somewhere to go next is the one whose first run failed'
      ).toBe(true)
    })

    it('takes an armed nudge off the screen when a second tour starts', async () => {
      const { controller } = await tourOnRunStep()
      mocks.engine.activeTour = null
      await nextTick()
      expect(controller.nudgeArmed.value).toBe(true)

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting

      expect(
        controller.nudgeArmed.value,
        'a nudge left over from the last tour would sit on top of this one'
      ).toBe(false)
    })

    it('congratulates nobody when the tour never appeared', async () => {
      mocks.steps = []
      mocks.activeWorkflow.value = TOUR_WORKFLOW
      mocks.engine.startTour.mockImplementation(async () => {
        await resolveRegisteredTour()
        return false
      })
      const controller = await freshController()

      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting

      expect(
        controller.tourWasShown.value,
        'a tour that resolved no steps made nothing for the nudge to celebrate'
      ).toBe(false)
    })

    it('stops offering the nudge once it is waved away', async () => {
      const { controller } = await tourOnRunStep()
      mocks.engine.activeTour = null
      await nextTick()

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
