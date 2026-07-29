import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import type { CoachStep } from '@/platform/onboarding/onboardingTours'

const TOUR_WORKFLOW = { path: 'tour.json' }
const OTHER_WORKFLOW = { path: 'other.json' }
const INTRO_PREVIEW_MS = 500

const mocks = vi.hoisted(() => ({
  canRunWorkflows: { value: true },
  showSubscriptionDialog: vi.fn(),
  workflowStatus: { value: new Map<unknown, string>() },
  executionErrors: { hasNodeError: false, hasPromptError: false },
  activeWorkflow: null as unknown,
  transformValid: true,
  steps: [] as CoachStep[],
  runState: { value: 'idle' } as Ref<string>,
  releaseFirstRunTargets: vi.fn(),
  engine: {
    activeTour: null as string | null,
    step: null as CoachStep | null,
    isLast: false,
    startTour: vi.fn(),
    next: vi.fn(),
    complete: vi.fn(),
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

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mocks.activeWorkflow
    }
  })
}))

vi.mock('./canvasCoachTarget', () => ({
  canvasTransformValid: () => mocks.transformValid
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

function runStep(): CoachStep {
  return { name: 'run', placement: 'bottom', selfAdvancing: true }
}

let controllerScope: EffectScope | undefined
let resolveRegisteredTour: () => Promise<unknown>

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
  const { useFirstRunTourController } =
    await import('./useFirstRunTourController')
  return controllerScope.run(() => useFirstRunTourController())!
}

/** A started tour sitting on its Run step, the state every run outcome acts on. */
async function tourOnRunStep() {
  mocks.steps = [runStep()]
  mocks.activeWorkflow = TOUR_WORKFLOW
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
    mocks.activeWorkflow = null
    mocks.transformValid = true
    mocks.steps = []
    mocks.engine.activeTour = null
    mocks.engine.step = null
    mocks.engine.isLast = false
  })

  afterEach(() => {
    controllerScope?.stop()
    controllerScope = undefined
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  describe('starting', () => {
    it('does not start before the canvas can place a spotlight', async () => {
      mocks.transformValid = false
      const controller = await freshController()

      await expect(controller.beginTour('image_z_image_turbo')).resolves.toBe(
        false
      )
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

    it('completes the tour when Run is its last step', async () => {
      await tourOnRunStep()
      mocks.engine.isLast = true

      mountRunButton('queue-button', () => {}).click()

      expect(mocks.engine.complete).toHaveBeenCalled()
    })

    it('ignores a run that finished for another workflow', async () => {
      await tourOnRunStep()
      mocks.activeWorkflow = OTHER_WORKFLOW

      await finishRun(OTHER_WORKFLOW, 'failed')

      expect(
        mocks.runState.value,
        'a job the tour did not start must not speak for the tour'
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

  describe('the paywall', () => {
    it('consumes a Run click it is going to refuse', async () => {
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
        'a refused run must never reach the handler that queues it'
      ).not.toHaveBeenCalled()
      expect(
        click.defaultPrevented,
        'the browser activates the button on its own unless the click is cancelled'
      ).toBe(true)
      expect(mocks.showSubscriptionDialog).toHaveBeenCalled()
      expect(
        mocks.engine.postpone,
        'whoever subscribes off the back of this still has their first run ahead of them'
      ).toHaveBeenCalled()
      expect(mocks.engine.skip).not.toHaveBeenCalled()
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
