import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type {
  DownloadProgressUpdate,
  DownloadState
} from '@comfyorg/comfyui-electron-types'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ProgressHandler = (data: DownloadProgressUpdate) => void

const progressHandler = vi.hoisted(() => {
  const state: { current: ProgressHandler | null } = { current: null }
  return state
})

const downloadManager = vi.hoisted(() => ({
  startDownload: vi.fn(),
  pauseDownload: vi.fn(),
  resumeDownload: vi.fn(),
  cancelDownload: vi.fn(),
  getAllDownloads: vi.fn(async () => [] as DownloadState[]),
  onDownloadProgress: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({ isDesktop: true }))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ DownloadManager: downloadManager })
}))

import { useElectronDownloadStore } from '@/platform/electronDownload/electronDownloadStore'

function emitProgress(overrides: Partial<DownloadProgressUpdate> = {}) {
  const payload: DownloadProgressUpdate = {
    url: 'https://civitai.com/api/download/models/1',
    filename: 'model.safetensors',
    savePath: '/tmp/checkpoints/model.safetensors',
    progress: 0.25,
    status: DownloadStatus.IN_PROGRESS,
    ...overrides
  }
  progressHandler.current?.(payload)
  return payload
}

async function loadStore() {
  const store = useElectronDownloadStore()
  // Flush the microtasks scheduled by `void initialize()` so the progress
  // handler is registered before tests start emitting events.
  await Promise.resolve()
  await Promise.resolve()
  return store
}

describe('useElectronDownloadStore', () => {
  beforeEach(() => {
    progressHandler.current = null
    downloadManager.startDownload.mockReset()
    downloadManager.pauseDownload.mockReset()
    downloadManager.resumeDownload.mockReset()
    downloadManager.cancelDownload.mockReset()
    downloadManager.getAllDownloads
      .mockReset()
      .mockImplementation(async () => [] as DownloadState[])
    downloadManager.onDownloadProgress.mockReset().mockImplementation((cb) => {
      progressHandler.current = cb as ProgressHandler
    })
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('cancel translation', () => {
    it('translates the ERROR event following a user cancel into CANCELLED', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/7'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      void store.cancel(url)
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })

      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.CANCELLED)
    })

    it('does not suppress a later genuine ERROR for the same URL', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/8'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      void store.cancel(url)
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })
      // A second ERROR must not be translated, because the flag is single-shot.
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })

      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.ERROR)
    })

    it('keeps a genuine ERROR when it was not preceded by cancel', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/9'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })

      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.ERROR)
    })

    it('translates a user-cancel ERROR without treating it as genuine ERROR', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/10'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      void store.cancel(url)
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })

      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.CANCELLED)
    })

    it('clears a pending cancel flag when the download completes instead', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/15'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      void store.cancel(url)
      emitProgress({ url, status: DownloadStatus.COMPLETED, progress: 1 })

      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })

      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.ERROR)
    })
  })

  describe('retry state', () => {
    it('keeps repeat ERRORs as genuine failures', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/11'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })

      expect(store.findByUrl(url)).toMatchObject({
        status: DownloadStatus.ERROR,
        progress: 0
      })
    })

    it('resets prior terminal status when retrying', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/12'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })

      void store.start({ url, savePath: '/tmp/x', filename: 'x.safetensors' })
      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.PENDING)

      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0.1 })
      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.ERROR)
    })
  })

  describe('actions', () => {
    it('normalizes persisted downloads from Electron on initialize', async () => {
      downloadManager.getAllDownloads.mockImplementationOnce(async () => [
        {
          url: 'https://civitai.com/api/download/models/16',
          filename: 'persisted.safetensors',
          state: DownloadStatus.CANCELLED,
          receivedBytes: 25,
          totalBytes: 100,
          isPaused: false
        }
      ])

      const store = await loadStore()

      expect(store.downloads).toEqual([
        {
          url: 'https://civitai.com/api/download/models/16',
          filename: 'persisted.safetensors',
          status: DownloadStatus.CANCELLED,
          progress: 0.25
        }
      ])
    })

    it('does not duplicate persisted downloads or listeners on repeated initialize', async () => {
      downloadManager.getAllDownloads.mockImplementation(async () => [
        {
          url: 'https://civitai.com/api/download/models/19',
          filename: 'persisted.safetensors',
          state: DownloadStatus.IN_PROGRESS,
          receivedBytes: 25,
          totalBytes: 100,
          isPaused: false
        }
      ])

      const store = await loadStore()
      await store.initialize()

      expect(store.downloads).toHaveLength(1)
      expect(downloadManager.onDownloadProgress).toHaveBeenCalledTimes(1)
    })

    it('remove(url) drops the entry and clears the cancel flag', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/13'
      emitProgress({ url, status: DownloadStatus.IN_PROGRESS })
      void store.cancel(url)
      store.remove(url)

      expect(store.findByUrl(url)).toBeUndefined()

      // After removal, a brand-new progress ERROR for the same URL must be
      // treated as a genuine failure, not a lingering user cancel.
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })
      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.ERROR)
    })

    it('start forwards to DownloadManager and clears the cancel flag', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/14'
      void store.cancel(url)
      void store.start({ url, savePath: '/tmp/x', filename: 'x.safetensors' })

      expect(downloadManager.startDownload).toHaveBeenCalledWith(
        url,
        '/tmp/x',
        'x.safetensors'
      )

      // Cancel flag must be cleared so subsequent ERROR for this URL surfaces
      // as a genuine failure.
      emitProgress({ url, status: DownloadStatus.ERROR, progress: 0 })
      expect(store.findByUrl(url)?.status).toBe(DownloadStatus.ERROR)
    })

    it('clears stale retry state and surfaces immediate start failures', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/17'
      emitProgress({
        url,
        status: DownloadStatus.ERROR,
        progress: 0.75,
        message: 'previous failure'
      })
      downloadManager.startDownload.mockRejectedValueOnce(
        new Error('disk full')
      )

      await expect(
        store.start({ url, savePath: '/tmp/x', filename: 'x.safetensors' })
      ).rejects.toThrow('disk full')

      expect(store.findByUrl(url)).toMatchObject({
        status: DownloadStatus.ERROR,
        progress: 0,
        message: 'disk full'
      })
    })

    it('persists first-attempt start failures for the stopped notice', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/20'
      downloadManager.startDownload.mockRejectedValueOnce(
        new Error('permission denied')
      )

      await expect(
        store.start({ url, savePath: '/tmp/x', filename: 'x.safetensors' })
      ).rejects.toThrow('permission denied')

      expect(store.findByUrl(url)).toMatchObject({
        url,
        filename: 'x.safetensors',
        savePath: '/tmp/x',
        status: DownloadStatus.ERROR,
        progress: 0,
        message: 'permission denied'
      })
    })

    it('forwards pause and resume to DownloadManager', async () => {
      const store = await loadStore()
      const url = 'https://civitai.com/api/download/models/18'

      void store.pause(url)
      void store.resume(url)

      expect(downloadManager.pauseDownload).toHaveBeenCalledWith(url)
      expect(downloadManager.resumeDownload).toHaveBeenCalledWith(url)
    })
  })
})
