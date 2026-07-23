import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  addEventListener:
    vi.fn<(event: string, listener: (event: Event) => void) => void>(),
  queuePrompt: vi.fn(() => Promise.resolve(true))
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: mocks.addEventListener
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    queuePrompt: mocks.queuePrompt,
    lastExecutionError: null
  }
}))

import { setupAutoQueueHandler } from '@/services/autoQueueService'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'

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
  })

  it('queues on executionGraphChanged instead of graphChanged', () => {
    setupAutoQueueHandler()

    const registration = mocks.addEventListener.mock.calls.find(
      ([event]) => event === 'executionGraphChanged'
    )
    if (!registration) throw new Error('executionGraphChanged listener missing')

    expect(mocks.addEventListener).not.toHaveBeenCalledWith(
      'graphChanged',
      expect.any(Function)
    )

    registration[1](new Event('executionGraphChanged'))

    expect(mocks.queuePrompt).toHaveBeenCalledWith(0, 2)
  })
})
