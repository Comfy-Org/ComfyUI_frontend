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
    )
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
})
