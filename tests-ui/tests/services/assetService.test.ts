import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { assetService } from '@/services/assetService'

// Test data constants
const MOCK_ASSETS = {
  checkpoints: {
    id: 'uuid-1',
    name: 'model1.safetensors',
    tags: ['models', 'checkpoints'],
    size: 123456
  },
  loras: {
    id: 'uuid-2',
    name: 'model2.safetensors',
    tags: ['models', 'loras'],
    size: 654321
  },
  vae: {
    id: 'uuid-3',
    name: 'vae1.safetensors',
    tags: ['models', 'vae'],
    size: 789012
  }
} as const

// Helper functions
function mockApiResponse(assets: any[], options = {}) {
  const response = {
    assets,
    total: assets.length,
    has_more: false,
    ...options
  }
  vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(response))
  return response
}

function mockApiError(status: number, statusText = 'Error') {
  vi.mocked(api.fetchApi).mockResolvedValueOnce(
    new Response(null, { status, statusText })
  )
}

function expectStandardPaths(folderName: string, result: any[]) {
  const folder = result.find((f) => f.name === folderName)
  expect(folder).toBeDefined()
  expect(folder.folders).toEqual(
    expect.arrayContaining([
      expect.stringContaining(`/ComfyUI/models/${folderName}`)
    ])
  )
}

describe('assetService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(api, 'fetchApi')
  })

  describe('getAssetModelFolders', () => {
    it('should return model folders with standard paths', async () => {
      mockApiResponse(Object.values(MOCK_ASSETS))

      const result = await assetService.getAssetModelFolders()

      expect(api.fetchApi).toHaveBeenCalledWith('/assets?tags=models')
      expect(result).toHaveLength(3)
      expectStandardPaths('checkpoints', result)
      expectStandardPaths('loras', result)
      expectStandardPaths('vae', result)
    })

    it('should handle empty response', async () => {
      mockApiResponse([])

      const result = await assetService.getAssetModelFolders()

      expect(result).toEqual([])
    })

    it('should handle fetch failure', async () => {
      vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))

      await expect(assetService.getAssetModelFolders()).rejects.toThrow(
        'Network error'
      )
    })

    it('should handle HTTP error response', async () => {
      mockApiError(500)

      await expect(assetService.getAssetModelFolders()).rejects.toThrow(
        'Unable to load model folders: Server returned 500. Please try again.'
      )
    })

    it('should deduplicate folder names from multiple assets', async () => {
      const duplicateAssets = [
        { ...MOCK_ASSETS.checkpoints, id: 'uuid-1' },
        { ...MOCK_ASSETS.checkpoints, id: 'uuid-2' }
      ]
      mockApiResponse(duplicateAssets)

      const result = await assetService.getAssetModelFolders()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('checkpoints')
      expectStandardPaths('checkpoints', result)
    })
  })

  describe('getAssetModels', () => {
    it('should return models for specific folder', async () => {
      const checkpointModels = [
        { ...MOCK_ASSETS.checkpoints, name: 'model1.safetensors' },
        { ...MOCK_ASSETS.checkpoints, name: 'model2.safetensors', id: 'uuid-2' }
      ]
      mockApiResponse(checkpointModels)

      const result = await assetService.getAssetModels('checkpoints')

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?tags=models,checkpoints'
      )
      expect(result).toEqual([
        { name: 'model1.safetensors', pathIndex: 0 },
        { name: 'model2.safetensors', pathIndex: 0 }
      ])
    })

    it('should handle empty folder response', async () => {
      mockApiResponse([])

      const result = await assetService.getAssetModels('nonexistent')

      expect(result).toEqual([])
    })

    it('should handle fetch failure', async () => {
      vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))

      await expect(assetService.getAssetModels('checkpoints')).rejects.toThrow(
        'Network error'
      )
    })

    it('should handle HTTP error response', async () => {
      mockApiError(404)

      await expect(assetService.getAssetModels('checkpoints')).rejects.toThrow(
        'Unable to load models for checkpoints: Server returned 404. Please try again.'
      )
    })

    it('should return only assets matching folder tag when mixed types present', async () => {
      const mixedAssets = [
        { ...MOCK_ASSETS.checkpoints, name: 'checkpoint.safetensors' },
        { ...MOCK_ASSETS.loras, name: 'lora.safetensors' }
      ]
      mockApiResponse(mixedAssets)

      const result = await assetService.getAssetModels('checkpoints')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'checkpoint.safetensors',
        pathIndex: 0
      })
    })

    it('should filter out assets with missing names', async () => {
      const validAsset = {
        ...MOCK_ASSETS.checkpoints,
        name: 'valid.safetensors'
      }
      const invalidAsset = { ...MOCK_ASSETS.checkpoints, name: undefined }
      mockApiResponse([validAsset, invalidAsset])

      const result = await assetService.getAssetModels('checkpoints')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ name: 'valid.safetensors', pathIndex: 0 })
    })
  })
})
