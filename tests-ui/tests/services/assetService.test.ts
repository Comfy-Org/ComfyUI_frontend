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
    it('should return required folders with correct ordering and standard paths', async () => {
      const assetsWithNonModelTags = [
        {
          id: 'uuid-1',
          name: 'model1.safetensors',
          tags: ['models', 'checkpoints', 'images', 'backgrounds'],
          size: 123456
        },
        {
          id: 'uuid-2',
          name: 'model2.safetensors',
          tags: ['models', 'unknown_folder'],
          size: 654321
        }
      ]
      mockApiResponse(assetsWithNonModelTags)

      const result = await assetService.getAssetModelFolders()

      expect(api.fetchApi).toHaveBeenCalledWith('/assets?tags=models')

      // Should return all 13 standard directories (excluding blacklisted configs, custom_nodes)
      expect(result).toHaveLength(13)

      // Verify ordering: legacy order first, then unknowns alphabetically
      const folderNames = result.map((f) => f.name)
      const legacyOrder = [
        'checkpoints',
        'clip',
        'clip_vision',
        'controlnet',
        'diffusion_models',
        'embeddings',
        'gligen',
        'hypernetworks',
        'loras',
        'style_models',
        'unet',
        'upscale_models',
        'vae'
      ]
      expect(folderNames).toEqual(legacyOrder)

      // All folders should have standard paths
      for (const folderName of legacyOrder) {
        expectStandardPaths(folderName, result)
      }

      // Should NOT include non-model tags or blacklisted folders
      expect(folderNames).not.toContain('images')
      expect(folderNames).not.toContain('backgrounds')
      expect(folderNames).not.toContain('configs')
      expect(folderNames).not.toContain('custom_nodes')
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
        '/assets?tags=models,checkpoints'
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

      expect(result).toHaveLength(1)
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

      expect(result).toHaveLength(1)
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

      expect(result).toHaveLength(1)
      expect(result).toContainEqual({
        name: 'valid-model.safetensors',
        pathIndex: 0
      })
      expect(result).not.toContainEqual({
        name: 'missing-model.safetensors',
        pathIndex: 0
      })
    })
  })
})
