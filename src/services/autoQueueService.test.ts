import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setupAutoQueueHandler } from '@/services/autoQueueService'

type ApiEvent = 'graphChanged'
type ApiListener = () => void
type Subscription = () => Promise<void> | void

const {
  listeners,
  queueCountStore,
  queueSettingsStore,
  appState,
  addEventListener,
  isInstantRunningMode
} = vi.hoisted(() => ({
  listeners: new Map<ApiEvent, ApiListener>(),
  queueCountStore: {
    count: 0,
    subscription: undefined as Subscription | undefined,
    $subscribe: vi.fn((_callback: Subscription) => {
      queueCountStore.subscription = _callback
    })
  },
  queueSettingsStore: {
    mode: 'manual',
    batchCount: 1
  },
  appState: {
    lastExecutionError: null as unknown,
    queuePrompt: vi.fn()
  },
  addEventListener: vi.fn((event: ApiEvent, listener: ApiListener) => {
    listeners.set(event, listener)
  }),
  isInstantRunningMode: vi.fn((mode: string) => mode === 'instant')
}))

vi.mock('@/scripts/api', () => ({
  api: { addEventListener }
}))

vi.mock('@/scripts/app', () => ({
  app: appState
}))

vi.mock('@/stores/queueStore', () => ({
  isInstantRunningMode,
  useQueuePendingTaskCountStore: () => queueCountStore,
  useQueueSettingsStore: () => queueSettingsStore
}))

beforeEach(() => {
  listeners.clear()
  queueCountStore.count = 0
  queueCountStore.subscription = undefined
  queueCountStore.$subscribe.mockClear()
  queueSettingsStore.mode = 'manual'
  queueSettingsStore.batchCount = 1
  appState.lastExecutionError = null
  appState.queuePrompt.mockReset().mockResolvedValue(undefined)
  addEventListener.mockClear()
  isInstantRunningMode
    .mockClear()
    .mockImplementation((mode) => mode === 'instant')
})

describe('setupAutoQueueHandler', () => {
  it('queues immediately on graph changes when change mode is idle', () => {
    queueSettingsStore.mode = 'change'
    queueSettingsStore.batchCount = 3

    setupAutoQueueHandler()
    listeners.get('graphChanged')?.()

    expect(appState.queuePrompt).toHaveBeenCalledWith(0, 3)
  })

  it('queues after pending work drains in instant mode', async () => {
    queueSettingsStore.mode = 'instant'
    queueSettingsStore.batchCount = 2
    queueCountStore.count = 0

    setupAutoQueueHandler()
    await queueCountStore.subscription?.()

    expect(appState.queuePrompt).toHaveBeenCalledWith(0, 2)
  })

  it('queues after a changed graph drains from an active queue', async () => {
    queueSettingsStore.mode = 'change'
    queueCountStore.count = 1

    setupAutoQueueHandler()
    await queueCountStore.subscription?.()
    listeners.get('graphChanged')?.()
    expect(appState.queuePrompt).not.toHaveBeenCalled()

    queueCountStore.count = 0
    await queueCountStore.subscription?.()

    expect(appState.queuePrompt).toHaveBeenCalledTimes(1)
  })

  it('does not requeue while work remains or the last run failed', async () => {
    queueSettingsStore.mode = 'instant'
    queueCountStore.count = 1

    setupAutoQueueHandler()
    await queueCountStore.subscription?.()

    appState.lastExecutionError = { message: 'failed' }
    queueCountStore.count = 0
    await queueCountStore.subscription?.()

    expect(appState.queuePrompt).not.toHaveBeenCalled()
  })
})
