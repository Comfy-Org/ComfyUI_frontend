import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import {
  type FileNameMapping,
  FileNameMappingService
} from '@/services/fileNameMappingService'

// Mock api module
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

describe('FileNameMappingService', () => {
  let service: FileNameMappingService

  beforeEach(() => {
    vi.clearAllMocks()
    // Create a new instance for each test to avoid cache pollution
    service = new FileNameMappingService()
  })

  describe('deduplication', () => {
    it('should not modify unique names', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation.png',
        'def456.jpg': 'profile.jpg',
        'ghi789.gif': 'animation.gif'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      const dedupMapping = service.getCachedMapping('input', true)

      // All unique names should remain unchanged
      expect(dedupMapping['abc123.png']).toBe('vacation.png')
      expect(dedupMapping['def456.jpg']).toBe('profile.jpg')
      expect(dedupMapping['ghi789.gif']).toBe('animation.gif')
    })

    it('should add hash suffix to duplicate names', async () => {
      const mockData: FileNameMapping = {
        'abc123def456.png': 'vacation.png',
        'xyz789uvw012.png': 'vacation.png',
        'mno345pqr678.png': 'vacation.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      const dedupMapping = service.getCachedMapping('input', true)

      // Check that all values are unique
      const values = Object.values(dedupMapping)
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBe(values.length)

      // Check that suffixes are added correctly
      expect(dedupMapping['abc123def456.png']).toBe('vacation_abc123de.png')
      expect(dedupMapping['xyz789uvw012.png']).toBe('vacation_xyz789uv.png')
      expect(dedupMapping['mno345pqr678.png']).toBe('vacation_mno345pq.png')
    })

    it('should preserve file extensions when deduplicating', async () => {
      const mockData: FileNameMapping = {
        'hash1234.safetensors': 'model.safetensors',
        'hash5678.safetensors': 'model.safetensors'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      const dedupMapping = service.getCachedMapping('input', true)

      // Extensions should be preserved
      expect(dedupMapping['hash1234.safetensors']).toBe(
        'model_hash1234.safetensors'
      )
      expect(dedupMapping['hash5678.safetensors']).toBe(
        'model_hash5678.safetensors'
      )
    })

    it('should handle files without extensions', async () => {
      const mockData: FileNameMapping = {
        abc123: 'README',
        def456: 'README',
        ghi789: 'LICENSE'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      const dedupMapping = service.getCachedMapping('input', true)

      // Files without extensions should still get deduplicated
      expect(dedupMapping['abc123']).toBe('README_abc123')
      expect(dedupMapping['def456']).toBe('README_def456')
      expect(dedupMapping['ghi789']).toBe('LICENSE') // Unique, no suffix
    })

    it('should build correct reverse mapping for deduplicated names', async () => {
      const mockData: FileNameMapping = {
        'hash1.png': 'image.png',
        'hash2.png': 'image.png',
        'hash3.jpg': 'photo.jpg'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      const reverseMapping = service.getCachedReverseMapping('input', true)

      // Reverse mapping should map deduplicated names back to hashes
      expect(reverseMapping['image_hash1.png']).toBe('hash1.png')
      expect(reverseMapping['image_hash2.png']).toBe('hash2.png')
      expect(reverseMapping['photo.jpg']).toBe('hash3.jpg')

      // Should not have original duplicate names in reverse mapping
      expect(reverseMapping['image.png']).toBeUndefined()
    })

    it('should handle mixed duplicate and unique names', async () => {
      const mockData: FileNameMapping = {
        'a1.png': 'sunset.png',
        'b2.png': 'sunset.png',
        'c3.jpg': 'portrait.jpg',
        'd4.gif': 'animation.gif',
        'e5.png': 'sunset.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      const dedupMapping = service.getCachedMapping('input', true)

      // Duplicates get suffixes
      expect(dedupMapping['a1.png']).toBe('sunset_a1.png')
      expect(dedupMapping['b2.png']).toBe('sunset_b2.png')
      expect(dedupMapping['e5.png']).toBe('sunset_e5.png')

      // Unique names remain unchanged
      expect(dedupMapping['c3.jpg']).toBe('portrait.jpg')
      expect(dedupMapping['d4.gif']).toBe('animation.gif')
    })

    it('should return non-deduplicated mapping when deduplicated=false', async () => {
      const mockData: FileNameMapping = {
        'hash1.png': 'image.png',
        'hash2.png': 'image.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')

      // Without deduplication flag
      const normalMapping = service.getCachedMapping('input', false)
      expect(normalMapping['hash1.png']).toBe('image.png')
      expect(normalMapping['hash2.png']).toBe('image.png')

      // With deduplication flag
      const dedupMapping = service.getCachedMapping('input', true)
      expect(dedupMapping['hash1.png']).toBe('image_hash1.png')
      expect(dedupMapping['hash2.png']).toBe('image_hash2.png')
    })
  })

  describe('getMapping', () => {
    it('should fetch mappings from API', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation_photo.png',
        'def456.jpg': 'profile_picture.jpg'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      const result = await service.getMapping('input')

      expect(api.fetchApi).toHaveBeenCalledWith('/files/mappings')
      expect(result).toEqual(mockData)
    })

    it('should cache mappings and not refetch within TTL', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation_photo.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      // First call
      await service.getMapping('input')
      expect(api.fetchApi).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const result = await service.getMapping('input')
      expect(api.fetchApi).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockData)
    })

    it('should return empty object on API failure', async () => {
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      const result = await service.getMapping('input')

      expect(result).toEqual({})
    })

    it('should return empty object on non-200 response', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any)

      const result = await service.getMapping('input')

      expect(result).toEqual({})
    })
  })

  describe('getCachedMapping', () => {
    it('should return empty object if no cached data', () => {
      const result = service.getCachedMapping('input')
      expect(result).toEqual({})
    })

    it('should return cached data after successful fetch', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation_photo.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')

      const result = service.getCachedMapping('input')
      expect(result).toEqual(mockData)
    })
  })

  describe('getCachedReverseMapping', () => {
    it('should return reverse mapping (human -> hash)', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation_photo.png',
        'def456.jpg': 'profile_picture.jpg'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')

      const reverseMapping = service.getCachedReverseMapping('input')
      expect(reverseMapping).toEqual({
        'vacation_photo.png': 'abc123.png',
        'profile_picture.jpg': 'def456.jpg'
      })
    })

    it('should return empty object if no cached data', () => {
      const result = service.getCachedReverseMapping('input')
      expect(result).toEqual({})
    })
  })

  describe('getHashFromHumanName', () => {
    it('should convert human name to hash', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation_photo.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')

      const assetId = service.getAssetIdFromHumanName(
        'vacation_photo.png',
        'input'
      )
      expect(assetId).toBe('abc123.png')
    })

    it('should return original name if no mapping exists', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      } as any)

      await service.getMapping('input')

      const result = service.getAssetIdFromHumanName('unknown.png', 'input')
      expect(result).toBe('unknown.png')
    })
  })

  describe('getHumanReadableName', () => {
    it('should convert hash to human-readable name', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation_photo.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      const humanName = await service.getHumanReadableName(
        'abc123.png',
        'input'
      )
      expect(humanName).toBe('vacation_photo.png')
    })

    it('should return hash if no mapping exists', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      } as any)

      const result = await service.getHumanReadableName('xyz789.png', 'input')
      expect(result).toBe('xyz789.png')
    })
  })

  describe('refreshMapping', () => {
    it('should invalidate cache and fetch fresh data', async () => {
      const mockData1: FileNameMapping = {
        'abc123.png': 'old_photo.png'
      }
      const mockData2: FileNameMapping = {
        'def456.png': 'new_photo.png'
      }

      vi.mocked(api.fetchApi)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData1
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData2
        } as any)

      // First fetch
      await service.getMapping('input')
      expect(service.getCachedMapping('input')).toEqual(mockData1)

      // Refresh should fetch new data
      const refreshedData = await service.refreshMapping('input')
      expect(api.fetchApi).toHaveBeenCalledTimes(2)
      expect(refreshedData).toEqual(mockData2)
      expect(service.getCachedMapping('input')).toEqual(mockData2)
    })
  })

  describe('invalidateCache', () => {
    it('should clear cache for specific file type', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'photo.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      expect(service.getCachedMapping('input')).toEqual(mockData)

      service.invalidateCache('input')
      expect(service.getCachedMapping('input')).toEqual({})
    })

    it('should clear all caches when no type specified', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'photo.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      await service.getMapping('input')
      await service.getMapping('output')

      service.invalidateCache()

      expect(service.getCachedMapping('input')).toEqual({})
      expect(service.getCachedMapping('output')).toEqual({})
    })
  })

  describe('ensureMappingsLoaded', () => {
    it('should preload mappings for immediate synchronous access', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'photo.png'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      // Ensure mappings are loaded
      await service.ensureMappingsLoaded('input')

      // Should be available synchronously
      const cached = service.getCachedMapping('input')
      expect(cached).toEqual(mockData)
    })

    it('should not throw on API failure', async () => {
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(service.ensureMappingsLoaded('input')).resolves.not.toThrow()

      // Should have empty mapping
      expect(service.getCachedMapping('input')).toEqual({})
    })
  })

  describe('applyMappingToArray', () => {
    it('should apply mapping to array of filenames', async () => {
      const mockData: FileNameMapping = {
        'abc123.png': 'vacation.png',
        'def456.jpg': 'profile.jpg'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      const result = await service.applyMappingToArray(
        ['abc123.png', 'def456.jpg', 'unknown.gif'],
        'input'
      )

      expect(result).toEqual(['vacation.png', 'profile.jpg', 'unknown.gif'])
    })

    it('should return original array on API failure', async () => {
      vi.mocked(api.fetchApi).mockRejectedValue(new Error('Network error'))

      const input = ['abc123.png', 'def456.jpg']
      const result = await service.applyMappingToArray(input, 'input')

      expect(result).toEqual(input)
    })
  })

  describe('edge cases', () => {
    it('should handle invalid JSON response gracefully', async () => {
      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      } as any)

      const result = await service.getMapping('input')
      expect(result).toEqual({})
    })

    it('should filter out invalid entries from response', async () => {
      const mockData = {
        'valid.png': 'photo.png',
        invalid: 123, // Invalid value type - will be filtered
        123: 'number_key', // Numeric key becomes string "123" in JS
        'another_valid.jpg': 'image.jpg'
      }

      vi.mocked(api.fetchApi).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData
      } as any)

      const result = await service.getMapping('input')

      // Should filter out non-string values but keep string keys (including coerced numeric keys)
      expect(result).toEqual({
        'valid.png': 'photo.png',
        '123': 'number_key', // Numeric key becomes string
        'another_valid.jpg': 'image.jpg'
      })
    })

    it('should handle null or array responses', async () => {
      // Test null response
      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => null
      } as any)

      let result = await service.getMapping('input')
      expect(result).toEqual({})

      // Test array response
      vi.mocked(api.fetchApi).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => []
      } as any)

      result = await service.getMapping('output')
      expect(result).toEqual({})
    })
  })
})
