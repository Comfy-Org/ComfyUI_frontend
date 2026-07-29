import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  engine: {
    activeTour: null as string | null,
    step: null as { name: string } | null,
    startTour: vi.fn(() => Promise.resolve(true)),
    next: vi.fn(),
    postpone: vi.fn()
  },
  canRun: { value: true },
  showSubscriptionDialog: vi.fn(),
  workflowStatus: { value: undefined as string | undefined },
  nodeError: null as { value: boolean } | null,
  settings: new Map<string, unknown>(),
  release: vi.fn(),
  registered: null as (() => Promise<unknown>) | null,
  runStateRef: null as { value: string } | null
}))

vi.mock('@/platform/onboarding/onboardingTourStore', () => ({
  useOnboardingTourStore: () => mocks.engine
}))
vi.mock('@/platform/onboarding/onboardingTours', () => ({
  registerTour: (_entry: string, definition: () => Promise<unknown>) => {
    mocks.registered = definition
  }
}))
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canRunWorkflows: mocks.canRun,
    showSubscriptionDialog: mocks.showSubscriptionDialog
  })
}))
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    getWorkflowStatus: () => mocks.workflowStatus.value
  })
}))
vi.mock('@/stores/executionErrorStore', async () => {
  const { ref } = await import('vue')
  mocks.nodeError = ref(false)
  return {
    useExecutionErrorStore: () => ({
      get hasNodeError() {
        return mocks.nodeError!.value
      },
      hasPromptError: false
    })
  }
})
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ activeWorkflow: null })
}))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => mocks.settings.get(key) ?? false,
    set: (key: string, value: unknown) => {
      mocks.settings.set(key, value)
      return Promise.resolve()
    }
  })
}))
vi.mock('./firstRunTourDefinition', () => ({
  firstRunTourSteps: vi.fn((_id: string, runState: { value: string }) => {
    mocks.runStateRef = runState
    return Promise.resolve([])
  }),
  releaseFirstRunTargets: mocks.release
}))

function runButton() {
  const button = document.createElement('button')
  button.dataset.testid = 'queue-button'
  document.body.append(button)
  return button
}

async function freshController() {
  const { useFirstRunTourController } =
    await import('./useFirstRunTourController')
  return useFirstRunTourController()
}

describe('useFirstRunTourController', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    document.body.replaceChildren()
    mocks.engine.activeTour = null
    mocks.engine.step = null
    mocks.engine.startTour.mockClear()
    mocks.engine.next.mockClear()
    mocks.engine.postpone.mockClear()
    mocks.canRun.value = true
    mocks.showSubscriptionDialog.mockClear()
    mocks.workflowStatus.value = undefined
    if (mocks.nodeError) mocks.nodeError.value = false
    mocks.settings.clear()
    mocks.release.mockClear()
    mocks.runStateRef = null
  })

  it('force-enables Nodes 2.0 and starts the registered tour', async () => {
    const controller = await freshController()
    expect(await controller.beginTour('image_z_image_turbo')).toBe(true)
    expect(mocks.settings.get('Comfy.VueNodes.Enabled')).toBe(true)
    expect(mocks.registered).not.toBeNull()
    expect(mocks.engine.startTour).toHaveBeenCalledWith('firstRun')
  })

  it('releases targets when the tour never starts', async () => {
    mocks.engine.startTour.mockResolvedValueOnce(false)
    const controller = await freshController()
    expect(await controller.beginTour('image_z_image_turbo')).toBe(false)
    expect(mocks.release).toHaveBeenCalled()
  })

  it('advances on a funded run click', async () => {
    const controller = await freshController()
    await controller.beginTour('image_z_image_turbo')
    mocks.engine.activeTour = 'firstRun'
    mocks.engine.step = { name: 'run' }
    runButton().click()
    expect(mocks.engine.next).toHaveBeenCalled()
  })

  it('consumes a paywalled run click and postpones the tour', async () => {
    const controller = await freshController()
    await controller.beginTour('image_z_image_turbo')
    mocks.engine.activeTour = 'firstRun'
    mocks.engine.step = { name: 'run' }
    mocks.canRun.value = false
    runButton().click()
    expect(mocks.showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'out_of_credits'
    })
    expect(mocks.engine.postpone).toHaveBeenCalled()
    expect(mocks.engine.next).not.toHaveBeenCalled()
  })

  it('fails the run state when a queued prompt is refused', async () => {
    const controller = await freshController()
    await controller.beginTour('image_z_image_turbo')
    mocks.engine.activeTour = 'firstRun'
    mocks.engine.step = { name: 'run' }
    runButton().click()

    await mocks.registered!()
    expect(mocks.runStateRef!.value).toBe('generating')

    mocks.nodeError!.value = true
    await nextTick()
    expect(mocks.runStateRef!.value).toBe('failed')
  })
})
