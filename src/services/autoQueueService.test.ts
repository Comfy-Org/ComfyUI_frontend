import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/platform/assets/composables/media/assetMappers')

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

const mocks = vi.hoisted(() => ({
  addEventListener:
    vi.fn<(event: string, listener: (event: Event) => void) => void>(),
  queuePrompt: vi.fn(() => Promise.resolve(true)),
  lastExecutionError: null as object | null,
  gateBlocks: false,
  activeWorkflow: null as LoadedComfyWorkflow | null
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

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => ({
    workflow: {
      get activeWorkflow() {
        return mocks.activeWorkflow
      }
    }
  }))
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
    mocks.activeWorkflow = null
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

  it('keeps Run Instant bound to the workflow where it started', async () => {
    const workflowA = { path: 'workflows/a.json' } as LoadedComfyWorkflow
    const workflowB = { path: 'workflows/b.json' } as LoadedComfyWorkflow
    const queueSettingsStore = useQueueSettingsStore()
    const queueCountStore = useQueuePendingTaskCountStore()

    mocks.activeWorkflow = workflowA
    queueSettingsStore.batchCount = 3
    setupAutoQueueHandler()

    queueSettingsStore.mode = 'instant-running'
    await nextTick()
    mocks.activeWorkflow = workflowB

    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(mocks.queuePrompt).toHaveBeenCalledWith(0, 3, {
      intent: { trigger_source: 'auto_queue' },
      workflow: workflowA
    })
  })

  it('captures the current workflow when Run Instant restarts', async () => {
    const workflowA = { path: 'workflows/a.json' } as LoadedComfyWorkflow
    const workflowB = { path: 'workflows/b.json' } as LoadedComfyWorkflow
    const queueSettingsStore = useQueueSettingsStore()
    const queueCountStore = useQueuePendingTaskCountStore()

    mocks.activeWorkflow = workflowA
    setupAutoQueueHandler()

    queueSettingsStore.mode = 'instant-running'
    await nextTick()
    queueSettingsStore.mode = 'instant-idle'
    await nextTick()
    mocks.activeWorkflow = workflowB
    queueSettingsStore.mode = 'instant-running'
    await nextTick()

    queueCountStore.count = 1
    await nextTick()
    queueCountStore.count = 0
    await nextTick()

    expect(mocks.queuePrompt).toHaveBeenCalledWith(0, 2, {
      intent: { trigger_source: 'auto_queue' },
      workflow: workflowB
    })
  })
})
