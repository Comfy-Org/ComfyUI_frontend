import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type { DownloadProgressUpdate } from '@comfyorg/comfyui-electron-types'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createElectronDownloadService } from './createElectronDownloadService'

let progressCallback: ((update: DownloadProgressUpdate) => void) | null = null

const mockDownloadManager = {
  getAllDownloads: vi.fn().mockResolvedValue([]),
  startDownload: vi.fn().mockResolvedValue(true),
  pauseDownload: vi.fn().mockResolvedValue(undefined),
  resumeDownload: vi.fn().mockResolvedValue(undefined),
  cancelDownload: vi.fn().mockResolvedValue(undefined),
  deleteModel: vi.fn().mockResolvedValue(true),
  onDownloadProgress: vi.fn((cb: (update: DownloadProgressUpdate) => void) => {
    progressCallback = cb
  })
}

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ DownloadManager: mockDownloadManager })
}))

describe('createElectronDownloadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    progressCallback = null
  })

  it('initializes with existing downloads from DownloadManager', async () => {
    mockDownloadManager.getAllDownloads.mockResolvedValueOnce([
      {
        url: 'https://example.com/model.safetensors',
        filename: 'model.safetensors',
        state: 'in_progress',
        receivedBytes: 500,
        totalBytes: 1000,
        isPaused: false
      }
    ])

    const service = await createElectronDownloadService()

    const allDownloads = service.getAll()
    expect(allDownloads).toHaveLength(1)
    expect(allDownloads[0]).toMatchObject({
      id: 'https://example.com/model.safetensors',
      filename: 'model.safetensors',
      status: 'in_progress',
      progress: 0.5
    })
  })

  it('start delegates to DownloadManager and returns a pending entry', async () => {
    const service = await createElectronDownloadService()

    const entry = await service.start({
      url: 'https://example.com/new-model.safetensors',
      savePath: '/models/checkpoints',
      filename: 'new-model.safetensors'
    })

    expect(mockDownloadManager.startDownload).toHaveBeenCalledWith(
      'https://example.com/new-model.safetensors',
      '/models/checkpoints',
      'new-model.safetensors'
    )
    expect(entry).toMatchObject({
      status: 'pending',
      progress: 0
    })
    expect(service.getById(entry.id)).toEqual(entry)
  })

  it('updates entries on progress callbacks from DownloadManager', async () => {
    const service = await createElectronDownloadService()

    await service.start({
      url: 'https://example.com/dl.safetensors',
      savePath: '/models',
      filename: 'dl.safetensors'
    })

    progressCallback!({
      url: 'https://example.com/dl.safetensors',
      filename: 'dl.safetensors',
      savePath: '/models',
      progress: 0.75,
      status: DownloadStatus.IN_PROGRESS
    })

    const updated = service.getById('https://example.com/dl.safetensors')
    expect(updated?.progress).toBe(0.75)
    expect(updated?.status).toBe('in_progress')
  })

  it('onProgress notifies subscribers when entries update', async () => {
    const service = await createElectronDownloadService()

    const url = 'https://example.com/sub.safetensors'
    await service.start({
      url,
      savePath: '/models',
      filename: 'sub.safetensors'
    })

    const listener = vi.fn()
    const unsubscribe = service.onProgress(url, listener)

    progressCallback!({
      url,
      filename: 'sub.safetensors',
      savePath: '/models',
      progress: 0.5,
      status: DownloadStatus.IN_PROGRESS
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ progress: 0.5 })
    )

    unsubscribe()
    progressCallback!({
      url,
      filename: 'sub.safetensors',
      savePath: '/models',
      progress: 1,
      status: DownloadStatus.COMPLETED
    })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('pause/resume/cancel delegate to DownloadManager', async () => {
    const service = await createElectronDownloadService()

    await service.pause('url1')
    expect(mockDownloadManager.pauseDownload).toHaveBeenCalledWith('url1')

    await service.resume('url2')
    expect(mockDownloadManager.resumeDownload).toHaveBeenCalledWith('url2')

    await service.cancel('url3')
    expect(mockDownloadManager.cancelDownload).toHaveBeenCalledWith('url3')
  })

  it('supports pause/resume', async () => {
    const service = await createElectronDownloadService()
    expect(service.supportsPauseResume).toBe(true)
  })
})
