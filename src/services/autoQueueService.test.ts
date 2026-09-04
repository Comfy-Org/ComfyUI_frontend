import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/platform/assets/composables/media/assetMappers')

const mocks = vi.hoisted(() => ({
  addEventListener:
    vi.fn<(event: string, listener: (event: Event) => void) => void>(),
  queuePrompt: vi.fn(() => Promise.resolve(true)),
  lastExecutionError: null as object | null,
  gateBlocks: false,
  concurrentExecutionEnabled: false
}))

vi.mock('@/composables/useConcurrentExecution', () => ({
  useConcurrentExecution: () => ({
    isConcurrentExecutionEnabled: {
      get value() {
        return mocks.concurrentExecutionEnabled
      }
    }
  })
}))

vi.mock('@/composables/billing/usePartnerNodesRunGate', () => ({
  partnerRunGateBlocksAutoQueue: () => mocks.gateBlocks
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
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'

function setupAndGetAutoQueueGraphChangedListener() {
  setupAutoQueueHandler()
  const registration = mocks.addEventListener.mock.calls.find(
    ([event]) => event === 'autoQueueGraphChanged'
  )
  if (!registration) throw new Error('autoQueueGraphChanged listener missing')
  return registration[1]
}

describe('setupAutoQueueHandler', () => {
  beforeEach(() => {
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
    mocks.gateBlocks = false
    mocks.concurrentExecutionEnabled = false
  })

  it('queues on autoQueueGraphChanged instead of graphChanged', () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()

    expect(mocks.addEventListener).not.toHaveBeenCalledWith(
      'graphChanged',
      expect.any(Function)
    )

    listener(new Event('autoQueueGraphChanged'))

    expect(mocks.queuePrompt).toHaveBeenCalledWith(0, 2, {
      intent: { trigger_source: 'auto_queue' }
    })
  })

  it('coalesces changes while busy and queues once after the queue drains', async () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()
    const queueCountStore = useQueuePendingTaskCountStore()

    listener(new Event('autoQueueGraphChanged'))
    listener(new Event('autoQueueGraphChanged'))

    expect(mocks.queuePrompt).toHaveBeenCalledTimes(1)

    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(mocks.queuePrompt).toHaveBeenCalledTimes(2)
    expect(mocks.queuePrompt).toHaveBeenLastCalledWith(0, 2, {
      intent: { trigger_source: 'auto_queue' }
    })
  })

  it('does not requeue a deferred change after an execution error', async () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()
    const queueCountStore = useQueuePendingTaskCountStore()

    listener(new Event('autoQueueGraphChanged'))
    listener(new Event('autoQueueGraphChanged'))
    mocks.lastExecutionError = new Error('execution failed')
    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(mocks.queuePrompt).toHaveBeenCalledTimes(1)
  })

  it('does not queue while the partner run gate blocks auto-queue', () => {
    mocks.gateBlocks = true
    const listener = setupAndGetAutoQueueGraphChangedListener()

    listener(new Event('autoQueueGraphChanged'))

    expect(mocks.queuePrompt).not.toHaveBeenCalled()
  })

  it('queues again once the gate clears rather than staying stuck', () => {
    mocks.gateBlocks = true
    const listener = setupAndGetAutoQueueGraphChangedListener()
    listener(new Event('autoQueueGraphChanged'))
    expect(mocks.queuePrompt).not.toHaveBeenCalled()

    mocks.gateBlocks = false
    listener(new Event('autoQueueGraphChanged'))
    expect(mocks.queuePrompt).toHaveBeenCalledTimes(1)
  })

  it('does not auto-queue while concurrent execution is enabled', () => {
    mocks.concurrentExecutionEnabled = true
    const listener = setupAndGetAutoQueueGraphChangedListener()

    listener(new Event('autoQueueGraphChanged'))

    expect(mocks.queuePrompt).not.toHaveBeenCalled()
  })

  it('responds to concurrent execution changes after setup', () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()

    mocks.concurrentExecutionEnabled = true
    listener(new Event('autoQueueGraphChanged'))
    expect(mocks.queuePrompt).not.toHaveBeenCalled()

    mocks.concurrentExecutionEnabled = false
    listener(new Event('autoQueueGraphChanged'))
    expect(mocks.queuePrompt).toHaveBeenCalledTimes(1)
  })

  it('does not re-queue when a busy processor reports the item as not run yet', async () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()

    mocks.queuePrompt.mockResolvedValueOnce(false)
    listener(new Event('autoQueueGraphChanged'))
    await nextTick()
    listener(new Event('autoQueueGraphChanged'))
    await nextTick()

    expect(
      mocks.queuePrompt,
      'a false from a busy processor already enqueued the item; do not queue it again'
    ).toHaveBeenCalledTimes(1)
  })
})
