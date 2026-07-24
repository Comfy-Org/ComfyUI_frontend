import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createCloudDownloadService } from './createCloudDownloadService'

const mockUploadAssetAsync = vi.fn()

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    uploadAssetAsync: (...args: unknown[]) => mockUploadAssetAsync(...args)
  }
}))

describe('createCloudDownloadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an in_progress entry when the upload is async', async () => {
    mockUploadAssetAsync.mockResolvedValueOnce({
      type: 'async',
      task: { task_id: 'task-123', status: 'running' }
    })

    const service = createCloudDownloadService()
    const entry = await service.start({
      url: 'https://example.com/model.safetensors',
      savePath: '/models/checkpoints',
      filename: 'model.safetensors'
    })

    expect(entry).toMatchObject({
      id: 'task-123',
      url: 'https://example.com/model.safetensors',
      status: 'in_progress',
      progress: 0
    })
    expect(service.getById('task-123')).toEqual(entry)
  })

  it('returns a completed entry when the upload resolves synchronously', async () => {
    mockUploadAssetAsync.mockResolvedValueOnce({
      type: 'sync',
      asset: { id: 'asset-456', name: 'model.safetensors' }
    })

    const service = createCloudDownloadService()
    const entry = await service.start({
      url: 'https://example.com/model.safetensors',
      savePath: '/models/checkpoints',
      filename: 'model.safetensors'
    })

    expect(entry).toMatchObject({
      id: 'https://example.com/model.safetensors',
      status: 'completed',
      progress: 1
    })
  })

  it('passes custom tags to uploadAssetAsync', async () => {
    mockUploadAssetAsync.mockResolvedValueOnce({
      type: 'sync',
      asset: { id: 'asset-789' }
    })

    const service = createCloudDownloadService()
    await service.start({
      url: 'https://example.com/lora.safetensors',
      savePath: '/models/loras',
      filename: 'lora.safetensors',
      tags: ['models', 'loras']
    })

    expect(mockUploadAssetAsync).toHaveBeenCalledWith({
      source_url: 'https://example.com/lora.safetensors',
      tags: ['models', 'loras']
    })
  })

  it('falls back to [models] when no tags provided', async () => {
    mockUploadAssetAsync.mockResolvedValueOnce({
      type: 'sync',
      asset: { id: 'asset-000' }
    })

    const service = createCloudDownloadService()
    await service.start({
      url: 'https://example.com/model.safetensors',
      savePath: '/models',
      filename: 'model.safetensors'
    })

    expect(mockUploadAssetAsync).toHaveBeenCalledWith({
      source_url: 'https://example.com/model.safetensors',
      tags: ['models']
    })
  })

  it('does not support pause/resume', () => {
    const service = createCloudDownloadService()
    expect(service.supportsPauseResume).toBe(false)
  })

  it('tracks entries in getAll after start', async () => {
    mockUploadAssetAsync.mockResolvedValueOnce({
      type: 'async',
      task: { task_id: 'task-track', status: 'running' }
    })

    const service = createCloudDownloadService()
    await service.start({
      url: 'https://example.com/a.safetensors',
      savePath: '/models',
      filename: 'a.safetensors'
    })

    expect(service.getAll()).toHaveLength(1)
    expect(service.getAll()[0].id).toBe('task-track')
  })
})
