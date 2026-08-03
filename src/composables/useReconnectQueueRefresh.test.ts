import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

function makeJob(id: string, status: JobListItem['status']): JobListItem {
  return {
    id,
    status,
    create_time: 0,
    update_time: 0,
    last_state_update: 0,
    priority: 0
  }
}

vi.mock('@/scripts/api', () => ({
  api: {
    getQueue: vi.fn(),
    getHistory: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    apiURL: vi.fn((p: string) => `/api${p}`)
  }
}))

describe('useReconnectQueueRefresh', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.restoreAllMocks()
    vi.mocked(api.getQueue).mockResolvedValue({ Running: [], Pending: [] })
    vi.mocked(api.getHistory).mockResolvedValue([])
  })

  it('forwards running+pending job ids to clearActiveJobIfStale', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [makeJob('run-1', 'in_progress')],
      Pending: [makeJob('pend-1', 'pending'), makeJob('pend-2', 'pending')]
    })
    const executionStore = useExecutionStore()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    const refresh = useReconnectQueueRefresh()
    await refresh()

    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledWith(
      new Set(['run-1', 'pend-1', 'pend-2'])
    )
  })

  it('passes an empty set when the queue is genuinely empty', async () => {
    const executionStore = useExecutionStore()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    const refresh = useReconnectQueueRefresh()
    await refresh()

    expect(clearSpy).toHaveBeenCalledWith(new Set())
  })

  it('reuses the prior queue snapshot when the fetch fails, so a still-running job is not falsely cleared', async () => {
    vi.mocked(api.getQueue)
      .mockResolvedValueOnce({
        Running: [makeJob('run-1', 'in_progress')],
        Pending: []
      })
      .mockRejectedValueOnce(new Error('network down'))
    const executionStore = useExecutionStore()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    const refresh = useReconnectQueueRefresh()
    await refresh() // primes the store with run-1
    await refresh() // network failure here — store must not go empty

    expect(clearSpy).toHaveBeenLastCalledWith(new Set(['run-1']))
  })
})
