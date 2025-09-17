import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: vi.fn(() => ({
    getRegisteredNodeTypes: vi.fn(
      () =>
        new Set([
          'CheckpointLoaderSimple',
          'LoraLoader',
          'VAELoader',
          'TestNode'
        ])
    ),
    modelToNodeMap: {
      'test-category': [{ nodeDef: { name: 'TestNode' }, key: 'test_input' }],
      'other-category': [{ nodeDef: { name: 'OtherNode' }, key: 'other_input' }],
      'checkpoints': [{ nodeDef: { name: 'CheckpointLoaderSimple' }, key: 'ckpt_name' }],
      'loras': [{ nodeDef: { name: 'LoraLoader' }, key: 'lora_name' }]
    }
  }))
}))

// Helper to create API-compliant test assets
function createTestAsset(overrides: Partial<AssetItem> = {}) {
  return {
    id: 'test-uuid',
    name: 'test-model.safetensors',
    asset_hash: 'blake3:test123',
    size: 123456,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

// Test data constants
const MOCK_ASSETS = {
  checkpoints: createTestAsset({
    id: 'uuid-1',
    name: 'model1.safetensors',
    tags: ['models', 'checkpoints']
  }),
  loras: createTestAsset({
    id: 'uuid-2',
    name: 'model2.safetensors',
    tags: ['models', 'loras']
  }),
  vae: createTestAsset({
    id: 'uuid-3',
    name: 'vae1.safetensors',
    tags: ['models', 'vae']
  })
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

describe('assetService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(api, 'fetchApi')
  })

  describe('getAssetModelFolders', () => {
    it('should extract directory names from asset tags and filter blacklisted ones', async () => {
      const assets = [
        createTestAsset({
          id: 'uuid-1',
          name: 'checkpoint1.safetensors',
          tags: ['models', 'checkpoints']
        }),
        createTestAsset({
          id: 'uuid-2',
          name: 'config.yaml',
          tags: ['models', 'configs'] // Blacklisted
        }),
        createTestAsset({
          id: 'uuid-3',
          name: 'vae1.safetensors',
          tags: ['models', 'vae']
        })
      ]
      mockApiResponse(assets)

      const result = await assetService.getAssetModelFolders()

      expect(api.fetchApi).toHaveBeenCalledWith('/assets?include_tags=models')
      expect(result).toHaveLength(2)

      const folderNames = result.map((f) => f.name)
      expect(folderNames).toEqual(['checkpoints', 'vae'])
      expect(folderNames).not.toContain('configs')
    })

    it('should handle empty responses', async () => {
      mockApiResponse([])
      const emptyResult = await assetService.getAssetModelFolders()
      expect(emptyResult).toHaveLength(0)
    })

    it('should handle network errors', async () => {
      vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))
      await expect(assetService.getAssetModelFolders()).rejects.toThrow(
        'Network error'
      )
    })

    it('should handle HTTP errors', async () => {
      mockApiError(500)
      await expect(assetService.getAssetModelFolders()).rejects.toThrow(
        'Unable to load model folders: Server returned 500. Please try again.'
      )
    })
  })

  describe('getAssetModels', () => {
    it('should return filtered models for folder', async () => {
      const assets = [
        { ...MOCK_ASSETS.checkpoints, name: 'valid.safetensors' },
        { ...MOCK_ASSETS.loras, name: 'lora.safetensors' }, // Wrong tag
        createTestAsset({
          id: 'uuid-4',
          name: 'missing-model.safetensors',
          tags: ['models', 'checkpoints', 'missing'] // Has missing tag
        })
      ]
      mockApiResponse(assets)

      const result = await assetService.getAssetModels('checkpoints')

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?include_tags=models,checkpoints'
      )
      expect(result).toEqual([
        expect.objectContaining({ name: 'valid.safetensors', pathIndex: 0 })
      ])
    })

    it('should handle errors and empty responses', async () => {
      // Empty response
      mockApiResponse([])
      const emptyResult = await assetService.getAssetModels('nonexistent')
      expect(emptyResult).toEqual([])

      // Network error
      vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))
      await expect(assetService.getAssetModels('checkpoints')).rejects.toThrow(
        'Network error'
      )

      // HTTP error
      mockApiError(404)
      await expect(assetService.getAssetModels('checkpoints')).rejects.toThrow(
        'Unable to load models for checkpoints: Server returned 404. Please try again.'
      )
    })
  })

  describe('isAssetBrowserEligible', () => {
    it('should return true for eligible widget names with registered node types', () => {
      expect(
        assetService.isAssetBrowserEligible(
          'ckpt_name',
          'CheckpointLoaderSimple'
        )
      ).toBe(true)
      expect(
        assetService.isAssetBrowserEligible('lora_name', 'LoraLoader')
      ).toBe(true)
      expect(assetService.isAssetBrowserEligible('vae_name', 'VAELoader')).toBe(
        true
      )
    })

    it('should return false for non-eligible widget names', () => {
      expect(assetService.isAssetBrowserEligible('seed', 'TestNode')).toBe(
        false
      )
      expect(assetService.isAssetBrowserEligible('steps', 'TestNode')).toBe(
        false
      )
      expect(
        assetService.isAssetBrowserEligible('sampler_name', 'TestNode')
      ).toBe(false)
      expect(assetService.isAssetBrowserEligible('', 'TestNode')).toBe(false)
    })

    it('should return false for eligible widget names with unregistered node types', () => {
      expect(
        assetService.isAssetBrowserEligible('ckpt_name', 'UnknownNode')
      ).toBe(false)
      expect(
        assetService.isAssetBrowserEligible('lora_name', 'UnknownNode')
      ).toBe(false)
    })
  })

  describe('getAssetsForNodeType', () => {
    it('should return assets for registered node type', async () => {
      const testAssets = [
        createTestAsset({
          id: 'uuid-1',
          name: 'test-asset.ext',
          user_metadata: { filename: 'test-asset.ext' },
          tags: ['models', 'test-category']
        })
      ]
      mockApiResponse(testAssets)

      const assets = await assetService.getAssetsForNodeType('TestNode')

      expect(api.fetchApi).toHaveBeenCalledWith('/assets?include_tags=models,test-category')
      expect(assets).toEqual(testAssets)
    })

    it('should return empty array for unregistered node type', async () => {
      const assets = await assetService.getAssetsForNodeType('UnknownNode')
      expect(assets).toEqual([])
      expect(api.fetchApi).not.toHaveBeenCalled()
    })

    it('should return empty array for empty string', async () => {
      const assets = await assetService.getAssetsForNodeType('')
      expect(assets).toEqual([])
      expect(api.fetchApi).not.toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      mockApiError(500)

      await expect(assetService.getAssetsForNodeType('TestNode')).rejects.toThrow(
        'Unable to load assets for TestNode: Server returned 500. Please try again.'
      )
    })

    it('should preserve full AssetItem structure with user_metadata', async () => {
      const testAssets = [
        createTestAsset({
          id: 'uuid-1',
          name: 'test-asset.ext',
          user_metadata: { filename: 'test-asset.ext' },
          tags: ['models', 'test-category']
        })
      ]
      mockApiResponse(testAssets)

      const assets = await assetService.getAssetsForNodeType('TestNode')

      expect(assets[0]).toHaveProperty('user_metadata.filename', 'test-asset.ext')
      expect(assets[0]).toHaveProperty('id', 'uuid-1')
      expect(assets[0]).toHaveProperty('tags')
    })
  })

  describe('getAssetDetails', () => {
    it('should fetch complete asset details by ID', async () => {
      const assetWithDetails = createTestAsset({
        id: 'asset-123',
        name: 'detailed-asset.safetensors',
        user_metadata: { filename: 'checkpoints/detailed-asset.safetensors' }
      })
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(assetWithDetails)
      } as Response)

      const asset = await assetService.getAssetDetails('asset-123')

      expect(api.fetchApi).toHaveBeenCalledWith('/assets/asset-123')
      expect(asset).toEqual(assetWithDetails)
    })

    it('should return asset with user_metadata.filename', async () => {
      const assetWithDetails = createTestAsset({
        id: 'asset-456',
        user_metadata: { filename: 'loras/test-lora.safetensors' }
      })
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(assetWithDetails)
      } as Response)

      const asset = await assetService.getAssetDetails('asset-456')

      expect(asset.user_metadata?.filename).toBe('loras/test-lora.safetensors')
    })

    it('should throw error when API returns 404', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: false,
        status: 404
      } as Response)

      await expect(assetService.getAssetDetails('nonexistent-id')).rejects.toThrow(
        'Unable to load asset details for nonexistent-id: Server returned 404. Please try again.'
      )
    })

    it('should throw error when response fails schema validation', async () => {
      // Return invalid asset data that fails schema validation
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'data' })
      } as Response)

      await expect(assetService.getAssetDetails('invalid-asset')).rejects.toThrow(
        /Invalid asset response against zod schema/
      )
    })
  })
})
