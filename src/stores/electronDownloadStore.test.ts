import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type { DownloadState } from '@comfyorg/comfyui-electron-types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { ElectronDownload } from '@/stores/electronDownloadStore'

const downloadManager = vi.hoisted(() => ({
  cancelDownload: vi.fn(),
  getAllDownloads: vi.fn(),
  onDownloadProgress: vi.fn(),
  pauseDownload: vi.fn(),
  resumeDownload: vi.fn(),
  startDownload: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({ isDesktop: true }))
vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ DownloadManager: downloadManager })
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function downloadState(overrides: Partial<DownloadState> = {}): DownloadState {
  return {
    url: 'https://example.com/model.safetensors',
    filename: 'model.safetensors',
    state: DownloadStatus.IN_PROGRESS,
    receivedBytes: 256,
    totalBytes: 1024,
    isPaused: false,
    ...overrides
  }
}

function progressUpdate(overrides: Partial<ElectronDownload> = {}) {
  return {
    url: 'https://example.com/model.safetensors',
    filename: 'model.safetensors',
    progress: 0.5,
    savePath: '/models/checkpoints/model.safetensors',
    status: DownloadStatus.IN_PROGRESS,
    ...overrides
  }
}

describe('useElectronDownloadStore progress observation', () => {
  let emitProgress: ((download: ElectronDownload) => void) | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    emitProgress = undefined
    downloadManager.getAllDownloads.mockReset().mockResolvedValue([])
    downloadManager.onDownloadProgress
      .mockReset()
      .mockImplementation((listener: (download: ElectronDownload) => void) => {
        emitProgress = listener
      })
  })

  it('restores status, bytes, and a valid byte fraction', async () => {
    downloadManager.getAllDownloads.mockResolvedValueOnce([
      downloadState({ state: DownloadStatus.PAUSED })
    ])
    const store = useElectronDownloadStore()

    await vi.waitFor(() => {
      expect(store.findByUrl('https://example.com/model.safetensors')).toEqual({
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        status: DownloadStatus.PAUSED,
        receivedBytes: 256,
        totalBytes: 1024,
        progress: 0.25
      })
    })
  })

  it('keeps restored bytes without inventing a fraction for an empty total', async () => {
    downloadManager.getAllDownloads.mockResolvedValueOnce([
      downloadState({ receivedBytes: 0, totalBytes: 0 })
    ])
    const store = useElectronDownloadStore()

    await vi.waitFor(() => {
      expect(store.findByUrl('https://example.com/model.safetensors')).toEqual({
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        status: DownloadStatus.IN_PROGRESS,
        receivedBytes: 0,
        totalBytes: 0
      })
    })
  })

  it('deduplicates restored downloads by URL across initialization', async () => {
    downloadManager.getAllDownloads.mockResolvedValue([
      downloadState({ state: DownloadStatus.PAUSED })
    ])
    const store = useElectronDownloadStore()

    await vi.waitFor(() => expect(store.downloads).toHaveLength(1))
    await store.initialize()

    expect(store.downloads).toHaveLength(1)
    expect(store.inProgressDownloads).toHaveLength(1)
  })

  it('installs the live listener before awaiting the restored snapshot', () => {
    downloadManager.getAllDownloads.mockReturnValueOnce(
      deferred<DownloadState[]>().promise
    )

    useElectronDownloadStore()

    expect(downloadManager.onDownloadProgress).toHaveBeenCalledOnce()
    expect(emitProgress).toBeTypeOf('function')
  })

  it('handles a rejected snapshot while keeping live updates usable', async () => {
    const automaticSnapshot = deferred<DownloadState[]>()
    downloadManager.getAllDownloads.mockReturnValueOnce(
      automaticSnapshot.promise
    )
    const store = useElectronDownloadStore()
    downloadManager.getAllDownloads.mockRejectedValueOnce(
      new Error('snapshot unavailable')
    )

    const outcome = await store.initialize().then(
      () => 'resolved',
      () => 'rejected'
    )
    automaticSnapshot.resolve([])
    await automaticSnapshot.promise

    expect(outcome).toBe('resolved')
    expect(emitProgress).toBeTypeOf('function')

    emitProgress?.(progressUpdate())

    expect(store.findByUrl('https://example.com/model.safetensors')).toEqual(
      progressUpdate()
    )
  })

  it('notifies only the changed live item and clears restored byte details', async () => {
    downloadManager.getAllDownloads.mockResolvedValueOnce([downloadState()])
    const store = useElectronDownloadStore()
    await vi.waitFor(() => {
      expect(
        store.findByUrl('https://example.com/model.safetensors')
      ).toBeDefined()
    })

    expect(store.subscribeToDownloadProgress).toBeTypeOf('function')
    if (!store.subscribeToDownloadProgress) return

    const listener = vi.fn()
    const stop = store.subscribeToDownloadProgress(listener)

    emitProgress?.(progressUpdate())

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining(progressUpdate())
    )
    expect(listener.mock.lastCall?.[0].receivedBytes).toBeUndefined()
    expect(listener.mock.lastCall?.[0].totalBytes).toBeUndefined()

    emitProgress?.(
      progressUpdate({
        url: 'https://example.com/other.safetensors',
        filename: 'other.safetensors'
      })
    )

    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener.mock.lastCall?.[0].url).toBe(
      'https://example.com/other.safetensors'
    )

    stop()
    emitProgress?.(progressUpdate({ progress: 0.75 }))
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
