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

      // Should return all standard model directories except blacklisted ones (configs, custom_nodes)
      expect(result).toHaveLength(13)
      expectStandardPaths('checkpoints', result)
      expectStandardPaths('loras', result)
      expectStandardPaths('vae', result)

      // Should also include other standard directories even without assets
      expectStandardPaths('clip', result)
      expectStandardPaths('controlnet', result)
      expectStandardPaths('embeddings', result)
    })

    it('should handle empty response', async () => {
      mockApiResponse([])

      const result = await assetService.getAssetModelFolders()

      // Should still return all standard directories even with no assets (except blacklisted)
      expect(result).toHaveLength(13)
      expectStandardPaths('checkpoints', result)
      expectStandardPaths('loras', result)
      expectStandardPaths('vae', result)
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

      // Should return all standard directories (not just the ones with assets, except blacklisted)
      expect(result).toHaveLength(13)

      // Checkpoints should be present and deduplicated
      const checkpointsFolder = result.find((f) => f.name === 'checkpoints')
      expect(checkpointsFolder).toBeDefined()
      expectStandardPaths('checkpoints', result)
    })

    it('should filter out non-model asset tags', async () => {
      const assetsWithNonModelTags = [
        {
          id: 'uuid-1',
          name: 'model1.safetensors',
          tags: [
            'models',
            'checkpoints',
            'images',
            'backgrounds',
            'wallpapers'
          ],
          size: 123456
        },
        {
          id: 'uuid-2',
          name: 'model2.safetensors',
          tags: ['models', 'loras', 'textures', 'graphics'],
          size: 654321
        }
      ]
      mockApiResponse(assetsWithNonModelTags)

      const result = await assetService.getAssetModelFolders()

      // Should return all standard directories (including checkpoints and loras from assets, except blacklisted)
      expect(result).toHaveLength(13)

      // Should include the valid model folders from assets
      const folderNames = result.map((f) => f.name)
      expect(folderNames).toContain('checkpoints')
      expect(folderNames).toContain('loras')

      // Should NOT include non-model tags (images, backgrounds, wallpapers, textures, graphics)
      expect(folderNames).not.toContain('images')
      expect(folderNames).not.toContain('backgrounds')
      expect(folderNames).not.toContain('wallpapers')
      expect(folderNames).not.toContain('textures')
      expect(folderNames).not.toContain('graphics')
    })

    it('should include all standard model directories even when empty', async () => {
      // Return only checkpoints assets, but standard directories should still appear
      mockApiResponse([MOCK_ASSETS.checkpoints])

      const result = await assetService.getAssetModelFolders()

      // Should include ALL standard directories, not just ones with assets
      const folderNames = result.map((f) => f.name).sort()

      // Standard model directories that should always appear (excluding blacklisted configs, custom_nodes)
      const expectedFolders = [
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
      ].sort()

      expect(folderNames).toEqual(expectedFolders)

      // All folders should have standard paths
      expectedFolders.forEach((folderName) => {
        expectStandardPaths(folderName, result)
      })
    })

    it('should exclude blacklisted folders (configs, custom_nodes) to match experimental API', async () => {
      mockApiResponse([])

      const result = await assetService.getAssetModelFolders()

      const folderNames = result.map((f) => f.name)
      expect(folderNames).not.toContain('configs')
      expect(folderNames).not.toContain('custom_nodes')
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
