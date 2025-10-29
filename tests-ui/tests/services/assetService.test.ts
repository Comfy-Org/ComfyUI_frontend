import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

const mockGetCategoryForNodeType = vi.fn()

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: vi.fn(() => ({
    getRegisteredNodeTypes: vi.fn(() => ({
      CheckpointLoaderSimple: 'ckpt_name',
      LoraLoader: 'lora_name',
      VAELoader: 'vae_name',
      TestNode: ''
    })),
    getCategoryForNodeType: mockGetCategoryForNodeType,
    modelToNodeMap: {
      checkpoints: [{ nodeDef: { name: 'CheckpointLoaderSimple' } }],
      loras: [{ nodeDef: { name: 'LoraLoader' } }],
      vae: [{ nodeDef: { name: 'VAELoader' } }]
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

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?include_tags=models&limit=500'
      )
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
        '/assets?include_tags=models,checkpoints&limit=500'
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
    it.for<[string, string, boolean, string]>([
      ['CheckpointLoaderSimple', 'ckpt_name', true, 'valid inputs'],
      ['LoraLoader', 'lora_name', true, 'valid inputs'],
      ['VAELoader', 'vae_name', true, 'valid inputs'],
      ['CheckpointLoaderSimple', 'type', false, 'other combo widgets'],
      ['UnknownNode', 'widget', false, 'unregistered types'],
      ['NotRegistered', 'widget', false, 'unregistered types']
    ])(
      'isAssetBrowserEligible("%s", "%s") should return %s for %s',
      ([type, name, expected]) => {
        expect(assetService.isAssetBrowserEligible(type, name)).toBe(expected)
      }
    )
  })

  describe('getAssetsForNodeType', () => {
    beforeEach(() => {
      mockGetCategoryForNodeType.mockClear()
    })

    it('should return empty array for unregistered node types', async () => {
      mockGetCategoryForNodeType.mockReturnValue(undefined)

      const result = await assetService.getAssetsForNodeType('UnknownNode')

      expect(mockGetCategoryForNodeType).toHaveBeenCalledWith('UnknownNode')
      expect(result).toEqual([])
    })

    it('should use getCategoryForNodeType for efficient category lookup', async () => {
      mockGetCategoryForNodeType.mockReturnValue('checkpoints')
      const testAssets = [MOCK_ASSETS.checkpoints]
      mockApiResponse(testAssets)

      const result = await assetService.getAssetsForNodeType(
        'CheckpointLoaderSimple'
      )

      expect(mockGetCategoryForNodeType).toHaveBeenCalledWith(
        'CheckpointLoaderSimple'
      )
      expect(result).toEqual(testAssets)

      // Verify API call includes correct category
      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?include_tags=models,checkpoints&limit=500'
      )
    })

    it('should return empty array when no category found', async () => {
      mockGetCategoryForNodeType.mockReturnValue(undefined)

      const result = await assetService.getAssetsForNodeType('TestNode')

      expect(result).toEqual([])
      expect(api.fetchApi).not.toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      mockGetCategoryForNodeType.mockReturnValue('loras')
      mockApiError(500, 'Internal Server Error')

      await expect(
        assetService.getAssetsForNodeType('LoraLoader')
      ).rejects.toThrow(
        'Unable to load assets for LoraLoader: Server returned 500. Please try again.'
      )
    })

    it('should return all assets without filtering for different categories', async () => {
      // Test checkpoints
      mockGetCategoryForNodeType.mockReturnValue('checkpoints')
      const checkpointAssets = [MOCK_ASSETS.checkpoints]
      mockApiResponse(checkpointAssets)

      let result = await assetService.getAssetsForNodeType(
        'CheckpointLoaderSimple'
      )
      expect(result).toEqual(checkpointAssets)

      // Test loras
      mockGetCategoryForNodeType.mockReturnValue('loras')
      const loraAssets = [MOCK_ASSETS.loras]
      mockApiResponse(loraAssets)

      result = await assetService.getAssetsForNodeType('LoraLoader')
      expect(result).toEqual(loraAssets)

      // Test vae
      mockGetCategoryForNodeType.mockReturnValue('vae')
      const vaeAssets = [MOCK_ASSETS.vae]
      mockApiResponse(vaeAssets)

      result = await assetService.getAssetsForNodeType('VAELoader')
      expect(result).toEqual(vaeAssets)
    })
  })

  describe('getAssetsByTag', () => {
    it('should fetch assets with correct tag query parameter', async () => {
      const testAssets = [MOCK_ASSETS.checkpoints, MOCK_ASSETS.loras]
      mockApiResponse(testAssets)

      const result = await assetService.getAssetsByTag('models')

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?include_tags=models&limit=500&include_public=true'
      )
      expect(result).toEqual(testAssets)
    })

    it('should filter out assets with missing tag', async () => {
      const testAssets = [
        MOCK_ASSETS.checkpoints,
        createTestAsset({
          id: 'uuid-missing',
          name: 'missing.safetensors',
          tags: ['models', 'checkpoints', 'missing']
        }),
        MOCK_ASSETS.loras
      ]
      mockApiResponse(testAssets)

      const result = await assetService.getAssetsByTag('models')

      expect(result).toHaveLength(2)
      expect(result).toEqual([MOCK_ASSETS.checkpoints, MOCK_ASSETS.loras])
      expect(result.some((a) => a.id === 'uuid-missing')).toBe(false)
    })

    it('should return empty array on API error', async () => {
      mockApiError(500)

      await expect(assetService.getAssetsByTag('models')).rejects.toThrow(
        'Unable to load assets for tag models: Server returned 500. Please try again.'
      )
    })

    it('should return empty array for empty response', async () => {
      mockApiResponse([])

      const result = await assetService.getAssetsByTag('nonexistent')

      expect(result).toEqual([])
    })

    it('should return AssetItem[] with full metadata', async () => {
      const fullAsset = createTestAsset({
        id: 'test-full',
        name: 'full-model.safetensors',
        asset_hash: 'blake3:full123',
        size: 999999,
        tags: ['models', 'checkpoints'],
        user_metadata: { filename: 'models/checkpoints/full-model.safetensors' }
      })
      mockApiResponse([fullAsset])

      const result = await assetService.getAssetsByTag('models')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(fullAsset)
      expect(result[0]).toHaveProperty('asset_hash', 'blake3:full123')
      expect(result[0]).toHaveProperty('user_metadata')
    })

    it('should exclude public assets when includePublic is false', async () => {
      const testAssets = [MOCK_ASSETS.checkpoints]
      mockApiResponse(testAssets)

      const result = await assetService.getAssetsByTag('input', false)

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?include_tags=input&limit=500&include_public=false'
      )
      expect(result).toEqual(testAssets)
    })

    it('should include public assets when includePublic is true', async () => {
      const testAssets = [MOCK_ASSETS.checkpoints, MOCK_ASSETS.loras]
      mockApiResponse(testAssets)

      const result = await assetService.getAssetsByTag('models', true)

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?include_tags=models&limit=500&include_public=true'
      )
      expect(result).toEqual(testAssets)
    })
  })
})
