import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DownloadStatus } from '@comfyorg/comfyui-electron-types'

const mockGetAllDownloads = vi.fn()
const mockStartDownload = vi.fn()
const mockPauseDownload = vi.fn()
const mockResumeDownload = vi.fn()
const mockCancelDownload = vi.fn()

let downloadProgressHandler:
  | ((download: {
      downloadId?: string
      url: string
      filename: string
      savePath?: string
      progress?: number
      status?: DownloadStatus
      state?: DownloadStatus
      receivedBytes?: number
      totalBytes?: number
      isPaused?: boolean
      message?: string
    }) => void)
  | undefined

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: true
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({
    DownloadManager: {
      getAllDownloads: mockGetAllDownloads,
      onDownloadProgress: (callback: typeof downloadProgressHandler) => {
        downloadProgressHandler = callback
      },
      startDownload: mockStartDownload,
      pauseDownload: mockPauseDownload,
      resumeDownload: mockResumeDownload,
      cancelDownload: mockCancelDownload
    }
  })
}))

import { useElectronDownloadStore } from './electronDownloadStore'

async function flushStoreSetup() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('electronDownloadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    downloadProgressHandler = undefined
    mockGetAllDownloads.mockResolvedValue([])
  })

  it('normalizes canonical desktop snapshots during initialization', async () => {
    mockGetAllDownloads.mockResolvedValue([
      {
        downloadId: '/models/checkpoints/model.safetensors',
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        savePath: '/models/checkpoints/model.safetensors',
        progress: 0.25,
        status: DownloadStatus.IN_PROGRESS,
        state: DownloadStatus.IN_PROGRESS,
        receivedBytes: 25,
        totalBytes: 100,
        isPaused: false
      }
    ])

    const store = useElectronDownloadStore()
    await flushStoreSetup()

    expect(store.downloads).toEqual([
      {
        downloadId: '/models/checkpoints/model.safetensors',
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        savePath: '/models/checkpoints/model.safetensors',
        progress: 0.25,
        status: 'running',
        error: undefined
      }
    ])
  })

  it('normalizes legacy desktop snapshots without canonical fields', async () => {
    mockGetAllDownloads.mockResolvedValue([
      {
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        state: DownloadStatus.PAUSED,
        receivedBytes: 5,
        totalBytes: 10,
        isPaused: true
      }
    ])

    const store = useElectronDownloadStore()
    await flushStoreSetup()

    expect(store.downloads).toEqual([
      {
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        savePath: '',
        progress: 0.5,
        status: 'paused',
        error: undefined
      }
    ])
  })

  it('upserts progress updates into the normalized store shape', async () => {
    const store = useElectronDownloadStore()
    await flushStoreSetup()

    downloadProgressHandler?.({
      downloadId: '/models/checkpoints/model.safetensors',
      url: 'https://example.com/model.safetensors',
      filename: 'model.safetensors',
      savePath: '/models/checkpoints/model.safetensors',
      progress: 0,
      status: DownloadStatus.PENDING
    })
    downloadProgressHandler?.({
      downloadId: '/models/checkpoints/model.safetensors',
      url: 'https://example.com/model.safetensors',
      filename: 'model.safetensors',
      savePath: '/models/checkpoints/model.safetensors',
      progress: 0.6,
      status: DownloadStatus.IN_PROGRESS
    })

    expect(store.downloads).toEqual([
      {
        downloadId: '/models/checkpoints/model.safetensors',
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        savePath: '/models/checkpoints/model.safetensors',
        progress: 0.6,
        status: 'running',
        error: undefined
      }
    ])
  })

  it('keeps same-url downloads separate when desktop supplies download ids', async () => {
    const store = useElectronDownloadStore()
    await flushStoreSetup()

    downloadProgressHandler?.({
      downloadId: '/models/checkpoints/model.safetensors',
      url: 'https://example.com/model.safetensors',
      filename: 'model.safetensors',
      savePath: '/models/checkpoints/model.safetensors',
      progress: 0.2,
      status: DownloadStatus.IN_PROGRESS
    })
    downloadProgressHandler?.({
      downloadId: '/models/loras/model.safetensors',
      url: 'https://example.com/model.safetensors',
      filename: 'model.safetensors',
      savePath: '/models/loras/model.safetensors',
      progress: 0.7,
      status: DownloadStatus.IN_PROGRESS
    })

    expect(store.downloads).toEqual([
      expect.objectContaining({
        downloadId: '/models/checkpoints/model.safetensors',
        savePath: '/models/checkpoints/model.safetensors',
        progress: 0.2
      }),
      expect.objectContaining({
        downloadId: '/models/loras/model.safetensors',
        savePath: '/models/loras/model.safetensors',
        progress: 0.7
      })
    ])
  })

  it('normalizes the desktop start result and stores its download id', async () => {
    mockStartDownload.mockResolvedValue({
      ok: true,
      download: {
        downloadId: '/models/checkpoints/model.safetensors',
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        savePath: '/models/checkpoints/model.safetensors',
        progress: 0,
        status: DownloadStatus.PENDING
      }
    })
    const store = useElectronDownloadStore()
    await flushStoreSetup()

    const result = await store.start({
      url: 'https://example.com/model.safetensors',
      savePath: '/models/checkpoints',
      filename: 'model.safetensors'
    })

    expect(result).toEqual({
      started: true,
      download: expect.objectContaining({
        downloadId: '/models/checkpoints/model.safetensors',
        status: 'created'
      })
    })
    expect(
      store.findByDownloadId('/models/checkpoints/model.safetensors')
    ).toEqual(
      expect.objectContaining({
        url: 'https://example.com/model.safetensors'
      })
    )
  })
})
