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
    it('should return only folders with actual assets', async () => {
      const assetsWithRealisticTags = [
        {
          id: 'uuid-1',
          name: 'checkpoint1.safetensors',
          tags: ['models', 'checkpoints'],
          size: 123456
        },
        {
          id: 'uuid-2',
          name: 'lora1.safetensors',
          tags: ['models', 'loras'],
          size: 654321
        },
        {
          id: 'uuid-3',
          name: 'vae1.safetensors',
          tags: ['models', 'vae'],
          size: 789012
        }
      ]
      mockApiResponse(assetsWithRealisticTags)

      const result = await assetService.getAssetModelFolders()

      expect(api.fetchApi).toHaveBeenCalledWith('/assets?include_tags=models')

      // Should return folders organized by secondary tags
      expect(result).toHaveLength(3)

      const folderNames = result.map((f) => f.name)
      expect(folderNames).toEqual(['checkpoints', 'loras', 'vae'])

      // All returned folders should have standard paths
      expectStandardPaths('checkpoints', result)
      expectStandardPaths('loras', result)
      expectStandardPaths('vae', result)
    })

    it('should use tags directly as directory names', async () => {
      const assetsWithDirectTags = [
        {
          id: 'uuid-1',
          name: 'model1.safetensors',
          tags: ['models', 'checkpoints'],
          size: 123456
        },
        {
          id: 'uuid-2',
          name: 'model2.safetensors',
          tags: ['models', 'controlnet'],
          size: 654321
        },
        {
          id: 'uuid-3',
          name: 'model3.safetensors',
          tags: ['models', 'embeddings'],
          size: 789012
        },
        {
          id: 'uuid-4',
          name: 'model4.safetensors',
          tags: ['models', 'vae'],
          size: 111222
        }
      ]
      mockApiResponse(assetsWithDirectTags)

      const result = await assetService.getAssetModelFolders()

      // Should use tags directly as directory names and sort alphabetically
      expect(result).toHaveLength(4)
      const folderNames = result.map((f) => f.name)
      expect(folderNames).toEqual([
        'checkpoints',
        'controlnet',
        'embeddings',
        'vae'
      ])

      // All returned folders should have standard paths
      expectStandardPaths('checkpoints', result)
      expectStandardPaths('controlnet', result)
      expectStandardPaths('embeddings', result)
      expectStandardPaths('vae', result)
    })

    it('should filter out blacklisted tags even if they appear in assets', async () => {
      const assetsWithBlacklisted = [
        {
          id: 'uuid-1',
          name: 'checkpoint1.safetensors',
          tags: ['models', 'checkpoints'],
          size: 123456
        },
        {
          id: 'uuid-2',
          name: 'config.yaml',
          tags: ['models', 'configs'], // Blacklisted
          size: 654321
        }
      ]
      mockApiResponse(assetsWithBlacklisted)

      const result = await assetService.getAssetModelFolders()

      // Should only return valid model directories, not blacklisted ones
      expect(result).toHaveLength(1)
      const folderNames = result.map((f) => f.name)
      expect(folderNames).toEqual(['checkpoints'])

      expect(folderNames).not.toContain('configs')
    })

    it('should return empty array when no assets exist', async () => {
      mockApiResponse([])

      const result = await assetService.getAssetModelFolders()

      expect(result).toHaveLength(0)
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
        '/assets?include_tags=models,checkpoints'
      )
      expect(result).toEqual([
        expect.objectContaining({ name: 'model1.safetensors', pathIndex: 0 }),
        expect.objectContaining({ name: 'model2.safetensors', pathIndex: 0 })
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

      expect(result).toContainEqual({
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

      expect(result).toContainEqual({ name: 'valid.safetensors', pathIndex: 0 })
    })

    it('should filter out models with missing tag', async () => {
      const assetsWithMissing = [
        {
          id: 'uuid-1',
          name: 'valid-model.safetensors',
          tags: ['models', 'checkpoints'],
          size: 123456
        },
        {
          id: 'uuid-2',
          name: 'missing-model.safetensors',
          tags: ['models', 'checkpoints', 'missing'],
          size: 654321
        }
      ]
      mockApiResponse(assetsWithMissing)

      const result = await assetService.getAssetModels('checkpoints')

      expect(result).not.toContainEqual({
        name: 'missing-model.safetensors',
        pathIndex: 0
      })
    })
  })
})
