import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { useExecutionStore } from '@/stores/executionStore'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'

function makeTask(id: string, status: JobListItem['status']): TaskItemImpl {
  return new TaskItemImpl({
    id,
    status,
    create_time: 0,
    update_time: 0,
    last_state_update: 0,
    priority: 0
  })
}

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    apiURL: vi.fn((p: string) => `/api${p}`)
  }
}))

describe('useReconnectQueueRefresh', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
  })

  it('refreshes the queue and forwards running+pending job ids to clearActiveJobIfStale', async () => {
    const queueStore = useQueueStore()
    const executionStore = useExecutionStore()

    const updateSpy = vi.spyOn(queueStore, 'update').mockResolvedValue()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    queueStore.runningTasks = [makeTask('run-1', 'in_progress')]
    queueStore.pendingTasks = [
      makeTask('pend-1', 'pending'),
      makeTask('pend-2', 'pending')
    ]

    const refresh = useReconnectQueueRefresh()
    await refresh()

    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledWith(
      new Set(['run-1', 'pend-1', 'pend-2'])
    )
    expect(updateSpy.mock.invocationCallOrder[0]).toBeLessThan(
      clearSpy.mock.invocationCallOrder[0]
    )
  })

  it('passes an empty set when the queue is empty', async () => {
    const queueStore = useQueueStore()
    const executionStore = useExecutionStore()

    vi.spyOn(queueStore, 'update').mockResolvedValue()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    queueStore.runningTasks = []
    queueStore.pendingTasks = []

    const refresh = useReconnectQueueRefresh()
    await refresh()

    expect(clearSpy).toHaveBeenCalledWith(new Set())
  })

  it('skips reconcile and preserves state when queue update throws', async () => {
    const queueStore = useQueueStore()
    const executionStore = useExecutionStore()

    vi.spyOn(queueStore, 'update').mockRejectedValue(new Error('boom'))
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const refresh = useReconnectQueueRefresh()
    await expect(refresh()).resolves.toBeUndefined()

    expect(clearSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })
})
