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

describe('assetService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(api, 'fetchApi')
  })

  describe('getAssetModelFolders', () => {
    it('should extract directory names from asset tags and filter blacklisted ones', async () => {
      const assets = [
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
        },
        {
          id: 'uuid-3',
          name: 'vae1.safetensors',
          tags: ['models', 'vae'],
          size: 789012
        }
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
        {
          id: 'uuid-4',
          name: 'missing-model.safetensors',
          tags: ['models', 'checkpoints', 'missing'], // Has missing tag
          size: 654321
        }
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
    it('should return true for eligible widget names', () => {
      expect(assetService.isAssetBrowserEligible('ckpt_name')).toBe(true)
      expect(assetService.isAssetBrowserEligible('lora_name')).toBe(true)
      expect(assetService.isAssetBrowserEligible('vae_name')).toBe(true)
    })

    it('should return false for non-eligible widget names', () => {
      expect(assetService.isAssetBrowserEligible('seed')).toBe(false)
      expect(assetService.isAssetBrowserEligible('steps')).toBe(false)
      expect(assetService.isAssetBrowserEligible('sampler_name')).toBe(false)
      expect(assetService.isAssetBrowserEligible('')).toBe(false)
    })
  })
})
