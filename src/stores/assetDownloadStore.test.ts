import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assetService } from '@/platform/assets/services/assetService'
import type { AssetDownloadWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetDetails: vi.fn()
  }
}))

function createDownloadMessage(
  overrides: Partial<AssetDownloadWsMessage> = {}
): AssetDownloadWsMessage {
  return {
    task_id: 'task-123',
    asset_id: 'asset-456',
    asset_name: 'model.safetensors',
    bytes_total: 1000,
    bytes_downloaded: 500,
    progress: 50,
    status: 'running',
    ...overrides
  }
}

function getEventHandler() {
  const call = vi
    .mocked(api.addEventListener)
    .mock.calls.find(([event]) => event === 'asset_download')
  return call?.[1] as (e: CustomEvent<AssetDownloadWsMessage>) => void
}

function dispatch(msg: AssetDownloadWsMessage) {
  const handler = getEventHandler()
  handler(new CustomEvent('asset_download', { detail: msg }))
}

describe('useAssetDownloadStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.useFakeTimers()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('handleAssetDownload', () => {
    it('tracks running downloads', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage())

      expect(store.activeDownloads).toHaveLength(1)
      expect(store.activeDownloads[0].taskId).toBe('task-123')
      expect(store.activeDownloads[0].progress).toBe(50)
    })

    it('moves download to finished when completed', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'running' }))
      expect(store.activeDownloads).toHaveLength(1)

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads).toHaveLength(1)
      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('moves download to finished when failed', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'running' }))
      dispatch(
        createDownloadMessage({ status: 'failed', error: 'Network error' })
      )

      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads).toHaveLength(1)
      expect(store.finishedDownloads[0].status).toBe('failed')
      expect(store.finishedDownloads[0].error).toBe('Network error')
    })

    it('ignores duplicate terminal state messages', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.finishedDownloads).toHaveLength(1)
    })
  })

  describe('trackDownload', () => {
    it('associates task with model type for completion tracking', () => {
      const store = useAssetDownloadStore()

      store.trackDownload('task-123', 'checkpoints')
      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))

      expect(store.completedDownloads).toHaveLength(1)
      expect(store.completedDownloads[0]).toMatchObject({
        taskId: 'task-123',
        modelType: 'checkpoints'
      })
    })
  })

  describe('stale download polling', () => {
    it('polls and completes stale downloads', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(assetService.getAssetDetails).mockResolvedValue({
        id: 'asset-456',
        name: 'model.safetensors',
        size: 1000,
        created_at: new Date().toISOString(),
        tags: []
      })

      dispatch(createDownloadMessage({ status: 'running' }))
      expect(store.activeDownloads).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(45000)

      expect(assetService.getAssetDetails).toHaveBeenCalledWith('asset-456')
      expect(store.activeDownloads).toHaveLength(0)
      expect(store.finishedDownloads[0].status).toBe('completed')
    })

    it('skips polling for recently updated downloads', async () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'running' }))

      await vi.advanceTimersByTimeAsync(10000)
      dispatch(createDownloadMessage({ status: 'running', progress: 60 }))
      await vi.advanceTimersByTimeAsync(20000)

      expect(assetService.getAssetDetails).not.toHaveBeenCalled()
      expect(store.activeDownloads).toHaveLength(1)
    })

    it('continues tracking on polling error', async () => {
      const store = useAssetDownloadStore()

      vi.mocked(assetService.getAssetDetails).mockRejectedValue(
        new Error('Not found')
      )
      dispatch(createDownloadMessage({ status: 'running' }))

      await vi.advanceTimersByTimeAsync(45000)

      expect(store.activeDownloads).toHaveLength(1)
    })
  })

  describe('clearFinishedDownloads', () => {
    it('removes all finished downloads', () => {
      const store = useAssetDownloadStore()

      dispatch(createDownloadMessage({ status: 'completed', progress: 100 }))
      expect(store.finishedDownloads).toHaveLength(1)

      store.clearFinishedDownloads()

      expect(store.finishedDownloads).toHaveLength(0)
    })
  })
})
