import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  activeTour: null as { value: string | null } | null,
  step: null as { value: { name: string } | null } | null,
  engine: {
    get activeTour() {
      return mocks.activeTour!.value
    },
    get step() {
      return mocks.step!.value
    },
    startTour: vi.fn(() => true),
    next: vi.fn(),
    postpone: vi.fn()
  },
  canRun: { value: true },
  showSubscriptionDialog: vi.fn(),
  nodeError: null as { value: boolean } | null,
  settings: new Map<string, unknown>(),
  release: vi.fn(),
  registered: null as (() => unknown) | null,
  runStateRef: null as { value: string } | null,
  apiTarget: null as EventTarget | null
}))

vi.mock('@/base/common/async', () => ({
  runWhenGlobalIdle: (runner: () => void) => runner()
}))
vi.mock('@/scripts/api', () => {
  mocks.apiTarget = new EventTarget()
  return { api: mocks.apiTarget }
})
vi.mock('@/scripts/app', () => ({ app: { canvas: null } }))
vi.mock('@/platform/onboarding/onboardingTourStore', async () => {
  const { ref } = await import('vue')
  mocks.activeTour = ref<string | null>(null)
  mocks.step = ref<{ name: string } | null>(null)
  return { useOnboardingTourStore: () => mocks.engine }
})
vi.mock('@/platform/onboarding/onboardingTours', () => ({
  registerTour: (_entry: string, definition: () => unknown) => {
    mocks.registered = definition
  }
}))
vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canRunWorkflows: mocks.canRun,
    showSubscriptionDialog: mocks.showSubscriptionDialog
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
  RUN_BUTTON_SELECTOR:
    '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]',
  firstRunTourSteps: vi.fn((_id: string, runState: { value: string }) => {
    mocks.runStateRef = runState
    return []
  }),
  releaseFirstRunTargets: mocks.release
}))

function clickRunButton() {
  const button = document.createElement('button')
  button.dataset.testid = 'queue-button'
  document.body.append(button)
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  button.dispatchEvent(event)
  return event
}

import { useFirstRunTourController } from './useFirstRunTourController'

describe('useFirstRunTourController', () => {
  setActivePinia(createPinia())
  const controller = useFirstRunTourController()

  beforeEach(async () => {
    if (mocks.activeTour) mocks.activeTour.value = null
    if (mocks.step) mocks.step.value = null
    await nextTick()
    document.body.replaceChildren()
    mocks.engine.startTour.mockClear()
    mocks.engine.next.mockClear()
    mocks.engine.postpone.mockClear()
    mocks.canRun.value = true
    mocks.showSubscriptionDialog.mockClear()
    if (mocks.nodeError) mocks.nodeError.value = false
    mocks.settings.clear()
    mocks.release.mockClear()
    mocks.runStateRef = null
  })

  it('force-enables Nodes 2.0 and starts the registered sync tour', async () => {
    expect(await controller.beginTour('image_z_image_turbo')).toBe(true)
    expect(mocks.settings.get('Comfy.VueNodes.Enabled')).toBe(true)
    expect(Array.isArray(mocks.registered!())).toBe(true)
    expect(mocks.engine.startTour).toHaveBeenCalledWith('firstRun')
  })

  it('releases targets when the tour never starts', async () => {
    mocks.engine.startTour.mockReturnValueOnce(false)
    expect(await controller.beginTour('image_z_image_turbo')).toBe(false)
    expect(mocks.release).toHaveBeenCalled()
  })

  it('advances one run per click and consumes repeats while generating', async () => {
    await controller.beginTour('image_z_image_turbo')
    mocks.registered!()
    mocks.activeTour!.value = 'firstRun'
    mocks.step!.value = { name: 'run' }
    await nextTick()
    expect(clickRunButton().defaultPrevented).toBe(false)
    expect(mocks.engine.next).toHaveBeenCalledTimes(1)
    expect(mocks.runStateRef!.value).toBe('generating')

    expect(clickRunButton().defaultPrevented).toBe(true)
    expect(mocks.engine.next).toHaveBeenCalledTimes(1)
  })

  it('consumes a paywalled run click and postpones the tour', async () => {
    await controller.beginTour('image_z_image_turbo')
    mocks.registered!()
    mocks.activeTour!.value = 'firstRun'
    mocks.step!.value = { name: 'run' }
    await nextTick()
    mocks.canRun.value = false
    expect(clickRunButton().defaultPrevented).toBe(true)
    expect(mocks.showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'out_of_credits'
    })
    expect(mocks.engine.postpone).toHaveBeenCalled()
    expect(mocks.engine.next).not.toHaveBeenCalled()
  })

  it('settles the run from execution events', async () => {
    await controller.beginTour('image_z_image_turbo')
    mocks.registered!()
    mocks.activeTour!.value = 'firstRun'
    mocks.step!.value = { name: 'run' }
    await nextTick()
    clickRunButton()
    expect(mocks.runStateRef!.value).toBe('generating')

    mocks.apiTarget!.dispatchEvent(new CustomEvent('execution_success'))
    expect(mocks.runStateRef!.value).toBe('succeeded')
  })

  it('fails the run when a queued prompt is refused', async () => {
    await controller.beginTour('image_z_image_turbo')
    mocks.registered!()
    mocks.activeTour!.value = 'firstRun'
    mocks.step!.value = { name: 'run' }
    await nextTick()
    clickRunButton()

    mocks.nodeError!.value = true
    await nextTick()
    expect(mocks.runStateRef!.value).toBe('failed')
  })
})
