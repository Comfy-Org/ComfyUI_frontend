import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  addEventListener:
    vi.fn<(event: string, listener: (event: Event) => void) => void>(),
  queuePrompt: vi.fn(() => Promise.resolve(true)),
  lastExecutionError: null as object | null
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: mocks.addEventListener
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    queuePrompt: mocks.queuePrompt,
    get lastExecutionError() {
      return mocks.lastExecutionError
    }
  }
}))

import { setupAutoQueueHandler } from '@/services/autoQueueService'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'

function setupAndGetExecutionGraphChangedListener() {
  setupAutoQueueHandler()
  const registration = mocks.addEventListener.mock.calls.find(
    ([event]) => event === 'executionGraphChanged'
  )
  if (!registration) throw new Error('executionGraphChanged listener missing')
  return registration[1]
}

describe('setupAutoQueueHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(
      createTestingPinia({
        createSpy: vi.fn,
        stubActions: false
      })
    )
    const queueSettingsStore = useQueueSettingsStore()
    queueSettingsStore.mode = 'change'
    queueSettingsStore.batchCount = 2
    useQueuePendingTaskCountStore().count = 0
    mocks.lastExecutionError = null
  })

  it('queues on executionGraphChanged instead of graphChanged', () => {
    const listener = setupAndGetExecutionGraphChangedListener()

    expect(mocks.addEventListener).not.toHaveBeenCalledWith(
      'graphChanged',
      expect.any(Function)
    )

    listener(new Event('executionGraphChanged'))

    expect(mocks.queuePrompt).toHaveBeenCalledWith(0, 2)
  })

  it('coalesces changes while busy and queues once after the queue drains', async () => {
    const listener = setupAndGetExecutionGraphChangedListener()
    const queueCountStore = useQueuePendingTaskCountStore()

    listener(new Event('executionGraphChanged'))
    listener(new Event('executionGraphChanged'))

    expect(mocks.queuePrompt).toHaveBeenCalledTimes(1)

    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(mocks.queuePrompt).toHaveBeenCalledTimes(2)
    expect(mocks.queuePrompt).toHaveBeenLastCalledWith(0, 2)
  })

  it('does not requeue a deferred change after an execution error', async () => {
    const listener = setupAndGetExecutionGraphChangedListener()
    const queueCountStore = useQueuePendingTaskCountStore()

    listener(new Event('executionGraphChanged'))
    listener(new Event('executionGraphChanged'))
    mocks.lastExecutionError = new Error('execution failed')
    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(mocks.queuePrompt).toHaveBeenCalledTimes(1)
  })
})
