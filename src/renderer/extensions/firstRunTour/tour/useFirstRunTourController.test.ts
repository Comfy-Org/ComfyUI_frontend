import type { DetachedWindowAPI } from 'happy-dom'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { TourEnding } from '@/platform/onboarding/onboardingTourStore'
import type {
  CoachStep,
  SpotlightStep
} from '@/platform/onboarding/onboardingTours'
import { useExecutionLifecycleStore } from '@/platform/execution/executionLifecycleStore'
import { useFirstRunTourController } from './useFirstRunTourController'
import * as tours from '@/platform/onboarding/onboardingTours'
import { toNodeId } from '@/types/nodeId'

import { TOUR_ROLE_PINS } from '../roles/tourRolePins'

const TOUR_WORKFLOW = { path: 'tour.json', instanceId: 'tour-instance' }
const OTHER_WORKFLOW = { path: 'other.json', instanceId: 'other-instance' }
const INTRO_PREVIEW_MS = 500
const OFFLINE_GRACE_MS = 20_000
const ACCEPT_DEADLINE_MS = 15_000
const IMAGE_SINK = TOUR_ROLE_PINS.image_z_image_turbo.sink

const mocks = vi.hoisted(() => {
  return {
    captureException: vi.fn(),
    addError: vi.fn(),
    graph: undefined as LGraph | undefined,
    canRunWorkflows: { value: true },
    showSubscriptionDialog: vi.fn(),
    activeWorkflow: {
      value: null as { path: string; instanceId: string } | null
    },
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
  }
})

vi.mock('@sentry/vue', () => ({
  captureException: mocks.captureException,
  isEnabled: () => true
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    addError: mocks.addError,
    getInitConfiguration: () => ({})
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraphOrUndefined() {
      return mocks.graph
    }
  }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canRunWorkflows: mocks.canRunWorkflows,
    showSubscriptionDialog: mocks.showSubscriptionDialog
  })
}))

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
async function freshController(beforeStart?: () => Promise<void>) {
  controllerScope?.stop()
  controllerScope = effectScope()
  resolveRegisteredTour = async () => {
    const definition = tours.tourDefinition('firstRun')
    return Array.isArray(definition) ? definition : definition?.()
  }
  registeredTourHolds = () => tours.tourHolds('firstRun')
  await beforeStart?.()
  return controllerScope.run(() => useFirstRunTourController())!
}

/** A started tour sitting on its Run step, the state every run outcome acts on. */
async function tourOnRunStep(
  beforeStart?: () => Promise<void>,
  templateId = 'image_z_image_turbo'
) {
  mocks.steps = [runStep()]
  mocks.activeWorkflow.value = TOUR_WORKFLOW
  mocks.engine.startTour.mockImplementation(async () => {
    await resolveRegisteredTour()
    mocks.engine.activeTour = 'firstRun'
    mocks.engine.step = runStep()
    return true
  })
  const controller = await freshController(beforeStart)

  const starting = controller.beginTour(templateId)
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

function submit(requestId = 1, workflow = TOUR_WORKFLOW) {
  const executions = useExecutionLifecycleStore()
  const handle = executions.beginSubmission(requestId, workflow.instanceId)
  executions.prepareSubmission(requestId, workflow.instanceId, {
    [IMAGE_SINK.id]: {
      class_type: IMAGE_SINK.type,
      inputs: {},
      _meta: { title: 'Result' }
    }
  })
  return handle
}

function output(jobId = 'tour-job', filename = 'first-output.png') {
  useExecutionLifecycleStore().receiveOutput({
    prompt_id: jobId,
    node: IMAGE_SINK.id,
    display_node: IMAGE_SINK.id,
    output: { images: [{ filename, subfolder: 'tour', type: 'output' }] }
  })
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
    mocks.graph = new LGraph()
    const output = new LGraphNode(IMAGE_SINK.type, IMAGE_SINK.type)
    output.id = toNodeId(IMAGE_SINK.id)
    mocks.graph.add(output)
    mocks.canRunWorkflows = ref(true)
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
    mocks.engine.next.mockImplementation(() => {
      mocks.engine.step = {
        kind: 'spotlight',
        name: 'result.image',
        placement: 'auto'
      }
    })
  })

  afterEach(() => {
    controllerScope?.stop()
    controllerScope = undefined
    useExecutionLifecycleStore().$dispose()
    document.body.replaceChildren()
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

  describe('execution handle consumption', () => {
    it('advances only when a matching workflow is submitted on the Run step', async () => {
      await tourOnRunStep()
      mountRunButton('queue-button', () => {}).click()
      expect(mocks.engine.next).not.toHaveBeenCalled()
      submit(10, OTHER_WORKFLOW)
      expect(mocks.engine.next).not.toHaveBeenCalled()
      submit(1)
      expect(mocks.engine.next).toHaveBeenCalledOnce()
      expect(mocks.runState.value).toBe('generating')
      submit(2)
      expect(mocks.engine.next).toHaveBeenCalledOnce()
    })

    it.for(['before acceptance', 'before success', 'after success'])(
      'retains the exact result when the tour ends %s',
      async (ending) => {
        const { controller } = await tourOnRunStep()
        submit()
        const executions = useExecutionLifecycleStore()
        if (ending === 'before acceptance') await endTour(COMPLETED)
        executions.acceptSubmission(1, 'tour-job')
        if (ending === 'before success') await endTour(COMPLETED)
        output()
        executions.succeedJob('tour-job', 123)
        if (ending === 'after success') await endTour(COMPLETED)
        expect(controller.nudgeArmed.value).toBe(true)
        expect(controller.nudgeCompletedAt.value).toBe(123)
        expect(controller.nudgeOutput.value?.filename).toBe('first-output.png')
      }
    )

    it('keeps the first handle while the next tour target is still pending', async () => {
      const { controller } = await tourOnRunStep()
      mocks.engine.next.mockImplementation(() => {})
      submit(1)
      submit(2)
      expect(mocks.engine.next).toHaveBeenCalledOnce()
      const executions = useExecutionLifecycleStore()
      executions.acceptSubmission(2, 'other-job')
      executions.succeedJob('other-job', 123)
      expect(controller.nudgeCompletedAt.value).toBeNull()
      executions.acceptSubmission(1, 'tour-job')
      executions.succeedJob('tour-job', 456)
      expect(controller.nudgeCompletedAt.value).toBe(456)
    })

    it('ignores a concurrent submission from the same workflow', async () => {
      const { controller } = await tourOnRunStep()
      submit(1)
      submit(2)
      const executions = useExecutionLifecycleStore()
      executions.acceptSubmission(2, 'other-job')
      output('other-job', 'wrong.png')
      executions.succeedJob('other-job')
      await endTour(COMPLETED)
      expect(controller.nudgeCompletedAt.value).toBeNull()
      expect(controller.nudgeOutput.value).toBeNull()
      output()
      executions.succeedJob('tour-job', 456)
      executions.acceptSubmission(1, 'tour-job')
      expect(controller.nudgeCompletedAt.value).toBe(456)
      expect(controller.nudgeOutput.value?.filename).toBe('first-output.png')
    })

    it('retains the submitted output selector after a canvas swap', async () => {
      const { controller } = await tourOnRunStep()
      submit()
      mocks.activeWorkflow.value = OTHER_WORKFLOW
      mocks.graph = new LGraph()
      await endTour(COMPLETED)
      output()
      useExecutionLifecycleStore().acceptSubmission(1, 'tour-job')
      useExecutionLifecycleStore().succeedJob('tour-job')
      expect(controller.nudgeOutput.value?.filename).toBe('first-output.png')
    })

    it.for(['shared-workflow', 'video_wan2_2_14B_i2v'])(
      'offers the browser after a successful %s run',
      async (templateId) => {
        const { controller } = await tourOnRunStep(undefined, templateId)
        submit()
        output()
        useExecutionLifecycleStore().succeedJob('tour-job')
        useExecutionLifecycleStore().acceptSubmission(1, 'tour-job')
        await endTour(COMPLETED)
        expect(controller.nudgeCompletedAt.value).not.toBeNull()
        expect(controller.nudgeOutput.value).toBeNull()
      }
    )

    it.for(['missing', 'different type'])(
      'rejects a declared output node that is %s at submission',
      async (change) => {
        const { controller } = await tourOnRunStep()
        const node = mocks.graph?.getNodeById(toNodeId(IMAGE_SINK.id))
        assert(node)
        if (change === 'missing') mocks.graph?.remove(node)
        else node.type = 'LoadImage'
        submit()
        output()
        useExecutionLifecycleStore().acceptSubmission(1, 'tour-job')
        expect(controller.nudgeOutput.value).toBeNull()
      }
    )

    it.for(['rejected', 'failed', 'cancelled'])(
      'ends the result promise without a nudge or timeout after %s',
      async (outcome) => {
        const { controller } = await tourOnRunStep()
        submit()
        const executions = useExecutionLifecycleStore()
        if (outcome === 'rejected')
          executions.rejectSubmission(1, 'submission_rejected')
        else {
          executions.acceptSubmission(1, 'tour-job')
          if (outcome === 'failed') executions.failJob('tour-job')
          else executions.cancelJob('tour-job')
        }
        await endTour(COMPLETED)
        await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS)
        expect(mocks.runState.value).toBe('failed')
        expect(controller.nudgeCompletedAt.value).toBeNull()
        expect(mocks.captureException).not.toHaveBeenCalled()
        expect(mocks.addError).not.toHaveBeenCalled()
      }
    )

    it.for(['acceptance_timeout', 'connection_timeout'])(
      'reports %s once to both telemetry providers after the tour ends',
      async (reason) => {
        const { controller } = await tourOnRunStep()
        submit()
        await endTour(COMPLETED)
        const executions = useExecutionLifecycleStore()
        if (reason === 'connection_timeout') {
          executions.acceptSubmission(1, 'tour-job')
          executions.connectionLost()
        }
        await vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS * 2)
        expect(controller.nudgeCompletedAt.value).toBeNull()
        expect(mocks.captureException).toHaveBeenCalledOnce()
        expect(mocks.addError).toHaveBeenCalledOnce()
        expect(mocks.captureException).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            tags: expect.objectContaining({ failure_reason: reason })
          })
        )
      }
    )

    it('keeps an accepted job awaiting a machine beyond the acceptance deadline', async () => {
      const { controller } = await tourOnRunStep()
      submit()
      useExecutionLifecycleStore().acceptSubmission(1, 'tour-job')
      await endTour(COMPLETED)
      await vi.advanceTimersByTimeAsync(ACCEPT_DEADLINE_MS * 2)
      expect(mocks.captureException).not.toHaveBeenCalled()
      useExecutionLifecycleStore().succeedJob('tour-job')
      expect(controller.nudgeCompletedAt.value).not.toBeNull()
    })

    it('releases the observer on dismissal without cancelling the execution', async () => {
      const { controller } = await tourOnRunStep()
      const handle = submit()
      await endTour(COMPLETED)
      controller.dismissNudge()
      useExecutionLifecycleStore().acceptSubmission(1, 'tour-job')
      output()
      useExecutionLifecycleStore().succeedJob('tour-job')
      expect(handle.state.value).toMatchObject({
        phase: 'accepted',
        job: { phase: 'succeeded' }
      })
      expect(controller.nudgeArmed.value).toBe(false)
      expect(controller.nudgeCompletedAt.value).toBeNull()
      expect(controller.nudgeOutput.value).toBeNull()
    })

    it('starts the next tour without the previous execution', async () => {
      const { controller } = await tourOnRunStep()
      submit()
      await endTour(COMPLETED)
      const starting = controller.beginTour('image_z_image_turbo')
      await vi.advanceTimersByTimeAsync(INTRO_PREVIEW_MS)
      await starting
      output()
      useExecutionLifecycleStore().acceptSubmission(1, 'tour-job')
      useExecutionLifecycleStore().succeedJob('tour-job')
      expect(mocks.runState.value).toBe('idle')
      expect(controller.nudgeArmed.value).toBe(false)
      expect(controller.nudgeOutput.value).toBeNull()
    })

    it('invalidates tour holds when its workflow or canvas disappears', async () => {
      await tourOnRunStep()
      expect(registeredTourHolds()).toBe(true)
      mocks.activeWorkflow.value = OTHER_WORKFLOW
      expect(registeredTourHolds()).toBe(false)
      mocks.activeWorkflow.value = TOUR_WORKFLOW
      mocks.linearMode.value = true
      expect(registeredTourHolds()).toBe(false)
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
