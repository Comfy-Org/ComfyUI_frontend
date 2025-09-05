import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

describe('Asset API Methods', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Mock the fetchApi method for each test
    vi.spyOn(api, 'fetchApi')
  })

  describe('getAssetModelFolders', () => {
    it('should return model folders from asset API', async () => {
      const mockResponse = {
        assets: [
          {
            id: 'uuid-1',
            name: 'model1.safetensors',
            tags: ['models', 'checkpoints'],
            size: 123456,
            created_at: '2023-01-01T00:00:00Z'
          },
          {
            id: 'uuid-2',
            name: 'model2.safetensors',
            tags: ['models', 'loras'],
            size: 654321,
            created_at: '2023-01-02T00:00:00Z'
          },
          {
            id: 'uuid-3',
            name: 'vae1.safetensors',
            tags: ['models', 'vae'],
            size: 789012,
            created_at: '2023-01-03T00:00:00Z'
          }
        ],
        total: 3,
        has_more: false
      }

      vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(mockResponse))

      const result = await api.getAssetModelFolders()

      expect(api.fetchApi).toHaveBeenCalledWith('/assets?tags=models')
      expect(result).toEqual([
        { name: 'checkpoints', folders: [] },
        { name: 'loras', folders: [] },
        { name: 'vae', folders: [] }
      ])
    })

    it('should handle empty response', async () => {
      const mockResponse = {
        assets: [],
        total: 0,
        has_more: false
      }

      vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(mockResponse))

      const result = await api.getAssetModelFolders()

      expect(result).toEqual([])
    })

    it('should handle fetch failure', async () => {
      vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))

      await expect(api.getAssetModelFolders()).rejects.toThrow('Network error')
    })

    it('should handle HTTP error response', async () => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(
        new Response(null, {
          status: 500,
          statusText: 'Internal Server Error'
        })
      )

      await expect(api.getAssetModelFolders()).rejects.toThrow(
        'Unable to load model folders: Server returned 500. Please try again.'
      )
    })

    it('should filter duplicate folder names', async () => {
      const mockResponse = {
        assets: [
          {
            id: 'uuid-1',
            name: 'model1.safetensors',
            tags: ['models', 'checkpoints'],
            size: 123456
          },
          {
            id: 'uuid-2',
            name: 'model2.safetensors',
            tags: ['models', 'checkpoints'], // duplicate checkpoints
            size: 654321
          }
        ],
        total: 2,
        has_more: false
      }

      vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(mockResponse))

      const result = await api.getAssetModelFolders()

      expect(result).toEqual([{ name: 'checkpoints', folders: [] }])
    })
  })

  describe('getAssetModels', () => {
    it('should return models for specific folder from asset API', async () => {
      const mockResponse = {
        assets: [
          {
            id: 'uuid-1',
            name: 'model1.safetensors',
            tags: ['models', 'checkpoints'],
            size: 123456,
            asset_hash: 'blake3:abc123',
            created_at: '2023-01-01T00:00:00Z',
            preview_url: '/api/assets/uuid-1/content'
          },
          {
            id: 'uuid-2',
            name: 'model2.safetensors',
            tags: ['models', 'checkpoints'],
            size: 654321,
            asset_hash: 'blake3:def456',
            created_at: '2023-01-02T00:00:00Z',
            preview_url: '/api/assets/uuid-2/content'
          }
        ],
        total: 2,
        has_more: false
      }

      vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(mockResponse))

      const result = await api.getAssetModels('checkpoints')

      expect(api.fetchApi).toHaveBeenCalledWith(
        '/assets?tags=models,checkpoints'
      )
      expect(result).toEqual([
        { name: 'model1.safetensors', pathIndex: 0 },
        { name: 'model2.safetensors', pathIndex: 0 }
      ])
    })

    it('should handle empty folder response', async () => {
      const mockResponse = {
        assets: [],
        total: 0,
        has_more: false
      }

      vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(mockResponse))

      const result = await api.getAssetModels('nonexistent')

      expect(result).toEqual([])
    })

    it('should handle fetch failure', async () => {
      vi.mocked(api.fetchApi).mockRejectedValueOnce(new Error('Network error'))

      await expect(api.getAssetModels('checkpoints')).rejects.toThrow(
        'Network error'
      )
    })

    it('should handle HTTP error response', async () => {
      vi.mocked(api.fetchApi).mockResolvedValueOnce(
        new Response(null, {
          status: 404,
          statusText: 'Not Found'
        })
      )

      await expect(api.getAssetModels('checkpoints')).rejects.toThrow(
        'Unable to load models for checkpoints: Server returned 404. Please try again.'
      )
    })

    it('should filter assets by folder tag', async () => {
      const mockResponse = {
        assets: [
          {
            id: 'uuid-1',
            name: 'checkpoint.safetensors',
            tags: ['models', 'checkpoints'],
            size: 123456
          },
          {
            id: 'uuid-2',
            name: 'lora.safetensors',
            tags: ['models', 'loras'], // different folder
            size: 654321
          }
        ],
        total: 2,
        has_more: false
      }

      vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(mockResponse))

      const result = await api.getAssetModels('checkpoints')

      // Should only return the checkpoint model
      expect(result).toEqual([{ name: 'checkpoint.safetensors', pathIndex: 0 }])
    })

    it('should handle models with missing names gracefully', async () => {
      const mockResponse = {
        assets: [
          {
            id: 'uuid-1',
            name: 'valid.safetensors',
            tags: ['models', 'checkpoints'],
            size: 123456
          },
          {
            id: 'uuid-2',
            // Missing name property
            tags: ['models', 'checkpoints'],
            size: 654321
          }
        ],
        total: 2,
        has_more: false
      }

      vi.mocked(api.fetchApi).mockResolvedValueOnce(Response.json(mockResponse))

      const result = await api.getAssetModels('checkpoints')

      // Should only return the valid model
      expect(result).toEqual([{ name: 'valid.safetensors', pathIndex: 0 }])
    })
  })
})
