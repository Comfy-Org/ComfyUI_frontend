import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flushPromises = () => vi.advanceTimersByTimeAsync(0)

import * as downloadApi from '../api/modelDownloadApi'
import type { DownloadState, DownloadStatus } from '../types'
import {
  downloadProgressFraction,
  useModelDownloadStore
} from './modelDownloadStore'

type ProgressHandler = (e: CustomEvent<DownloadStatus>) => void

const eventHandler = vi.hoisted(() => {
  const state: { current: ProgressHandler | null } = { current: null }
  return state
})

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn((_event: string, handler: ProgressHandler) => {
      eventHandler.current = handler
    })
  }
}))

vi.mock('../api/modelDownloadApi', () => ({
  enqueueDownload: vi.fn(),
  listDownloads: vi.fn(),
  pauseDownload: vi.fn(),
  resumeDownload: vi.fn(),
  cancelDownload: vi.fn(),
  setDownloadPriority: vi.fn(),
  deleteDownload: vi.fn(),
  clearDownloads: vi.fn()
}))

function createStatus(overrides: Partial<DownloadStatus> = {}): DownloadStatus {
  return {
    download_id: 'd1',
    model_id: 'loras/x.safetensors',
    url: 'https://huggingface.co/x.safetensors',
    status: 'active',
    priority: 0,
    total_bytes: 1000,
    bytes_done: 250,
    progress: 0.25,
    speed_bps: 100,
    eta_seconds: 10,
    segments: null,
    error: null,
    created_at: 1,
    updated_at: 2,
    ...overrides
  }
}

function dispatch(status: DownloadStatus) {
  if (!eventHandler.current) throw new Error('handler not registered')
  eventHandler.current(new CustomEvent('download_progress', { detail: status }))
}

describe('useModelDownloadStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.resetAllMocks()
    eventHandler.current = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('upserts rows from download_progress events', () => {
    const store = useModelDownloadStore()

    dispatch(createStatus({ download_id: 'd1', bytes_done: 100 }))
    dispatch(createStatus({ download_id: 'd1', bytes_done: 900 }))
    dispatch(createStatus({ download_id: 'd2', status: 'queued' }))

    expect(store.downloadList).toHaveLength(2)
    expect(
      store.downloadList.find((d) => d.download_id === 'd1')?.bytes_done
    ).toBe(900)
  })

  it('splits active and terminal downloads', () => {
    const store = useModelDownloadStore()
    const states: DownloadState[] = [
      'queued',
      'active',
      'paused',
      'verifying',
      'completed',
      'failed',
      'cancelled'
    ]
    states.forEach((status, idx) =>
      dispatch(createStatus({ download_id: `d${idx}`, status }))
    )

    expect(store.activeDownloads.map((d) => d.status)).toEqual([
      'queued',
      'active',
      'paused',
      'verifying'
    ])
    expect(store.historyDownloads.map((d) => d.status)).toEqual([
      'completed',
      'failed',
      'cancelled'
    ])
    expect(store.activeDownloadCount).toBe(4)
  })

  it('inserts an optimistic queued row on enqueue', async () => {
    vi.mocked(downloadApi.enqueueDownload).mockResolvedValue({
      download_id: 'new-id',
      accepted: true
    })
    const store = useModelDownloadStore()

    const result = await store.enqueue({
      url: 'https://huggingface.co/x.safetensors',
      model_id: 'loras/x.safetensors'
    })

    expect(result.download_id).toBe('new-id')
    const row = store.downloadList.find((d) => d.download_id === 'new-id')
    expect(row?.status).toBe('queued')
    expect(row?.model_id).toBe('loras/x.safetensors')
  })

  it('optimistically updates status when pausing', async () => {
    vi.mocked(downloadApi.pauseDownload).mockResolvedValue()
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))

    await store.pause('d1')

    expect(store.downloadList.find((d) => d.download_id === 'd1')?.status).toBe(
      'paused'
    )
    expect(downloadApi.pauseDownload).toHaveBeenCalledWith('d1')
  })

  it('optimistically updates status when resuming', async () => {
    vi.mocked(downloadApi.resumeDownload).mockResolvedValue()
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'paused' }))

    await store.resume('d1')

    expect(store.downloadList.find((d) => d.download_id === 'd1')?.status).toBe(
      'queued'
    )
    expect(downloadApi.resumeDownload).toHaveBeenCalledWith('d1')
  })

  it('marks a download cancelled after the API call resolves', async () => {
    vi.mocked(downloadApi.cancelDownload).mockResolvedValue()
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))

    await store.cancel('d1')

    expect(store.downloadList.find((d) => d.download_id === 'd1')?.status).toBe(
      'cancelled'
    )
    expect(downloadApi.cancelDownload).toHaveBeenCalledWith('d1')
  })

  it('optimistically updates priority and calls the API', async () => {
    vi.mocked(downloadApi.setDownloadPriority).mockResolvedValue()
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'queued', priority: 0 }))

    await store.setPriority('d1', 5)

    expect(
      store.downloadList.find((d) => d.download_id === 'd1')?.priority
    ).toBe(5)
    expect(downloadApi.setDownloadPriority).toHaveBeenCalledWith('d1', 5)
  })

  it('is a no-op when patching priority for an unknown id', async () => {
    vi.mocked(downloadApi.setDownloadPriority).mockResolvedValue()
    const store = useModelDownloadStore()

    await store.setPriority('missing', 5)

    expect(store.downloadList).toHaveLength(0)
    expect(downloadApi.setDownloadPriority).toHaveBeenCalledWith('missing', 5)
  })

  it('finds a download by model id', () => {
    const store = useModelDownloadStore()
    dispatch(
      createStatus({ download_id: 'd1', model_id: 'loras/x.safetensors' })
    )

    expect(store.findByModelId('loras/x.safetensors')?.download_id).toBe('d1')
    expect(store.findByModelId('loras/missing.safetensors')).toBeUndefined()
  })

  describe('hydrate', () => {
    it('replaces the download map with the fetched list', async () => {
      const store = useModelDownloadStore()
      dispatch(createStatus({ download_id: 'stale', status: 'active' }))
      vi.mocked(downloadApi.listDownloads).mockResolvedValue([
        createStatus({ download_id: 'fresh', status: 'active' })
      ])

      await store.hydrate()

      expect(store.downloadList.map((d) => d.download_id)).toEqual(['fresh'])
    })

    it('records a completion when a refreshed row transitions to completed', async () => {
      const store = useModelDownloadStore()
      dispatch(createStatus({ download_id: 'd1', status: 'active' }))
      vi.mocked(downloadApi.listDownloads).mockResolvedValue([
        createStatus({
          download_id: 'd1',
          model_id: 'loras/x.safetensors',
          status: 'completed'
        })
      ])

      await store.hydrate()

      expect(store.lastCompletedDownload).toMatchObject({
        downloadId: 'd1',
        modelId: 'loras/x.safetensors',
        directory: 'loras'
      })
    })

    it('does not re-record a completion for a row that was already completed', async () => {
      const store = useModelDownloadStore()
      dispatch(createStatus({ download_id: 'd1', status: 'completed' }))
      const firstTimestamp = store.lastCompletedDownload?.timestamp
      vi.mocked(downloadApi.listDownloads).mockResolvedValue([
        createStatus({ download_id: 'd1', status: 'completed' })
      ])

      await store.hydrate()

      expect(store.lastCompletedDownload?.timestamp).toBe(firstTimestamp)
    })
  })

  it('records the last completed download once on the completing transition', () => {
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))
    expect(store.lastCompletedDownload).toBeNull()

    dispatch(
      createStatus({
        download_id: 'd1',
        model_id: 'loras/x.safetensors',
        status: 'completed'
      })
    )

    expect(store.lastCompletedDownload).toMatchObject({
      downloadId: 'd1',
      modelId: 'loras/x.safetensors',
      directory: 'loras'
    })

    const firstTimestamp = store.lastCompletedDownload?.timestamp
    dispatch(createStatus({ download_id: 'd1', status: 'completed' }))
    expect(store.lastCompletedDownload?.timestamp).toBe(firstTimestamp)
  })

  it('refetches when a download fails without an error message', async () => {
    vi.mocked(downloadApi.listDownloads).mockResolvedValue([
      createStatus({ download_id: 'd1', status: 'failed', error: 'gated' })
    ])
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))

    dispatch(createStatus({ download_id: 'd1', status: 'failed', error: null }))
    await flushPromises()

    expect(downloadApi.listDownloads).toHaveBeenCalledOnce()
    expect(store.downloadList.find((d) => d.download_id === 'd1')?.error).toBe(
      'gated'
    )
  })

  it('does not refetch when the failure event already carries an error', async () => {
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))

    dispatch(
      createStatus({ download_id: 'd1', status: 'failed', error: 'disk full' })
    )
    await flushPromises()

    expect(downloadApi.listDownloads).not.toHaveBeenCalled()
    expect(store.downloadList.find((d) => d.download_id === 'd1')?.error).toBe(
      'disk full'
    )
  })

  it('deletes a row through the backend so it stays gone', async () => {
    vi.mocked(downloadApi.deleteDownload).mockResolvedValue()
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))
    dispatch(createStatus({ download_id: 'd2', status: 'completed' }))

    await store.remove('d2')

    expect(downloadApi.deleteDownload).toHaveBeenCalledWith('d2')
    expect(store.downloadList.map((d) => d.download_id)).toEqual(['d1'])
  })

  it('clears every history row in one backend call, leaving active downloads', async () => {
    vi.mocked(downloadApi.clearDownloads).mockResolvedValue(2)
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))
    dispatch(createStatus({ download_id: 'd2', status: 'completed' }))
    dispatch(createStatus({ download_id: 'd3', status: 'failed' }))

    await store.clearHistory()

    expect(downloadApi.clearDownloads).toHaveBeenCalledOnce()
    expect(downloadApi.deleteDownload).not.toHaveBeenCalled()
    expect(store.downloadList.map((d) => d.download_id)).toEqual(['d1'])
  })

  it('keeps history rows locally when the bulk clear fails', async () => {
    vi.mocked(downloadApi.clearDownloads).mockRejectedValue(new Error('boom'))
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd2', status: 'completed' }))

    await expect(store.clearHistory()).rejects.toThrow('boom')
    expect(store.downloadList.map((d) => d.download_id)).toEqual(['d2'])
  })

  it('keeps the row locally when the backend delete fails', async () => {
    vi.mocked(downloadApi.deleteDownload).mockRejectedValue(new Error('boom'))
    const store = useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd2', status: 'completed' }))

    await expect(store.remove('d2')).rejects.toThrow('boom')
    expect(store.downloadList.map((d) => d.download_id)).toEqual(['d2'])
  })

  it('polls the list when active downloads go stale', async () => {
    vi.mocked(downloadApi.listDownloads).mockResolvedValue([])
    useModelDownloadStore()
    dispatch(createStatus({ download_id: 'd1', status: 'active' }))

    await vi.advanceTimersByTimeAsync(15_000)

    expect(downloadApi.listDownloads).toHaveBeenCalled()
  })

  describe('downloadProgressFraction', () => {
    it('uses live progress when present', () => {
      expect(downloadProgressFraction(createStatus({ progress: 0.4 }))).toBe(
        0.4
      )
    })

    it('derives from bytes when progress is null', () => {
      expect(
        downloadProgressFraction(
          createStatus({ progress: null, bytes_done: 500, total_bytes: 1000 })
        )
      ).toBe(0.5)
    })

    it('returns null when total is unknown', () => {
      expect(
        downloadProgressFraction(
          createStatus({ progress: null, total_bytes: null })
        )
      ).toBeNull()
    })
  })
})
