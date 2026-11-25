import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ExecutionErrorWsMessage } from '@comfyorg/api-client/executionTypes'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'

vi.mock(import('@/platform/assets/adapters/outputAssetMappers'), { spy: true })

const mocks = vi.hoisted(() => ({
  gateBlocks: false
}))

vi.mock(import('@/platform/auth/partnerNode/usePartnerNodesRunGate'), () => ({
  partnerRunGateBlocksAutoQueue: () => mocks.gateBlocks
}))

vi.mock(import('@/scripts/api'))

vi.mock(import('@/scripts/app'))

import { setupAutoQueueHandler } from '@/platform/queue/runtime/autoQueueService'
import { useQueueSettingsStore } from '@/platform/queue/stores/queueSettingsStore'
import { useQueuePendingTaskCountStore } from '@/platform/queue/stores/queueStore'

function setupAndGetAutoQueueGraphChangedListener() {
  onTestFinished(setupAutoQueueHandler())
  const apiEvents: EventTarget = api
  return (event: Event) => apiEvents.dispatchEvent(event)
}

describe('setupAutoQueueHandler', () => {
  beforeEach(() => {
    vi.mocked(app.queuePrompt).mockResolvedValue(true)
    vi.spyOn(app, 'lastExecutionError', 'get').mockReturnValue(null)
    const queueSettingsStore = useQueueSettingsStore()
    queueSettingsStore.mode = 'change'
    queueSettingsStore.batchCount = 2
    useQueuePendingTaskCountStore().count = 0
    mocks.gateBlocks = false
  })

  it('queues on autoQueueGraphChanged instead of graphChanged', () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()

    expect(api.addEventListener).not.toHaveBeenCalledWith(
      'graphChanged',
      expect.any(Function)
    )

    listener(new Event('autoQueueGraphChanged'))

    expect(app.queuePrompt).toHaveBeenCalledWith(0, 2, {
      intent: { trigger_source: 'auto_queue' }
    })
  })

  it('defers changes when setup starts with jobs already queued', async () => {
    const queueCountStore = useQueuePendingTaskCountStore()
    queueCountStore.count = 2
    const listener = setupAndGetAutoQueueGraphChangedListener()

    listener(new Event('autoQueueGraphChanged'))
    listener(new Event('autoQueueGraphChanged'))

    expect(app.queuePrompt).not.toHaveBeenCalled()
    queueCountStore.count = 0
    await nextTick()

    expect(app.queuePrompt).toHaveBeenCalledExactlyOnceWith(0, 2, {
      intent: { trigger_source: 'auto_queue' }
    })
  })

  it('coalesces changes while busy and queues once after the queue drains', async () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()
    const queueCountStore = useQueuePendingTaskCountStore()

    listener(new Event('autoQueueGraphChanged'))
    listener(new Event('autoQueueGraphChanged'))

    expect(app.queuePrompt).toHaveBeenCalledTimes(1)

    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(app.queuePrompt).toHaveBeenCalledTimes(2)
    expect(app.queuePrompt).toHaveBeenLastCalledWith(0, 2, {
      intent: { trigger_source: 'auto_queue' }
    })
  })

  it('does not requeue a deferred change after an execution error', async () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()
    const queueCountStore = useQueuePendingTaskCountStore()

    listener(new Event('autoQueueGraphChanged'))
    listener(new Event('autoQueueGraphChanged'))
    const executionError: ExecutionErrorWsMessage = {
      prompt_id: 'prompt-1',
      node_id: 'node-1',
      node_type: 'TestNode',
      executed: [],
      exception_message: 'execution failed',
      exception_type: 'Error',
      traceback: [],
      current_inputs: {},
      current_outputs: {},
      timestamp: 1
    }
    vi.spyOn(app, 'lastExecutionError', 'get').mockReturnValue(executionError)
    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(app.queuePrompt).toHaveBeenCalledTimes(1)
  })

  it('queues again once the gate clears rather than staying stuck', () => {
    mocks.gateBlocks = true
    const listener = setupAndGetAutoQueueGraphChangedListener()
    listener(new Event('autoQueueGraphChanged'))
    expect(app.queuePrompt).not.toHaveBeenCalled()

    mocks.gateBlocks = false
    listener(new Event('autoQueueGraphChanged'))
    expect(app.queuePrompt).toHaveBeenCalledTimes(1)
  })

  it('does not re-queue when a busy processor reports the item as not run yet', async () => {
    const listener = setupAndGetAutoQueueGraphChangedListener()

    vi.mocked(app.queuePrompt).mockResolvedValueOnce(false)
    listener(new Event('autoQueueGraphChanged'))
    await nextTick()
    listener(new Event('autoQueueGraphChanged'))
    await nextTick()

    expect(
      app.queuePrompt,
      'a false from a busy processor already enqueued the item; do not queue it again'
    ).toHaveBeenCalledTimes(1)
  })

  it.for([
    { mode: 'disabled', expected: 0 },
    { mode: 'instant-idle', expected: 0 },
    { mode: 'instant-running', expected: 1 },
    { mode: 'change', expected: 0 }
  ] as const)(
    'queues $expected batches on drain in $mode mode without a deferred change',
    async ({ mode, expected }) => {
      useQueueSettingsStore().mode = mode
      setupAndGetAutoQueueGraphChangedListener()
      const queueCountStore = useQueuePendingTaskCountStore()

      queueCountStore.count = 1
      await nextTick()
      queueCountStore.count = 0
      await nextTick()

      expect(app.queuePrompt).toHaveBeenCalledTimes(expected)
    }
  )

  it('stops graph-change and queue-drain submissions when disposed', async () => {
    const stop = setupAutoQueueHandler()
    onTestFinished(stop)
    stop()

    api.dispatchCustomEvent('autoQueueGraphChanged')
    useQueueSettingsStore().mode = 'instant-running'
    const queueCountStore = useQueuePendingTaskCountStore()
    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(app.queuePrompt).not.toHaveBeenCalled()
  })

  it('does not retain a disposed handler when set up again', () => {
    const stop = setupAutoQueueHandler()
    onTestFinished(stop)
    stop()
    const listener = setupAndGetAutoQueueGraphChangedListener()

    listener(new Event('autoQueueGraphChanged'))

    expect(app.queuePrompt).toHaveBeenCalledOnce()
  })
})
