import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModel,
  getAssetDescription,
  getAssetDisplayName,
  getAssetSourceUrl,
  getAssetTags,
  getAssetTriggerPhrases,
  getSourceName
} from '@/platform/assets/utils/assetMetadataUtils'

describe('assetMetadataUtils', () => {
  const mockAsset: AssetItem = {
    id: 'test-id',
    name: 'test-model',
    asset_hash: 'hash123',
    size: 1024,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z'
  }

  describe('getAssetDescription', () => {
    it('should return string description when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { description: 'A test model' }
      }
      expect(getAssetDescription(asset)).toBe('A test model')
    })

    it('should return null when description is not a string', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { description: 123 }
      }
      expect(getAssetDescription(asset)).toBeNull()
    })

    it('should return null when no metadata', () => {
      expect(getAssetDescription(mockAsset)).toBeNull()
    })
  })

  describe('getAssetBaseModel', () => {
    it('should return string base_model when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { base_model: 'SDXL' }
      }
      expect(getAssetBaseModel(asset)).toBe('SDXL')
    })

    it('should return null when base_model is not a string', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { base_model: 123 }
      }
      expect(getAssetBaseModel(asset)).toBeNull()
    })

    it('should return null when no metadata', () => {
      expect(getAssetBaseModel(mockAsset)).toBeNull()
    })
  })

  describe('getAssetDisplayName', () => {
    it('should return display_name when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { display_name: 'My Custom Name' }
      }
      expect(getAssetDisplayName(asset)).toBe('My Custom Name')
    })

    it('should fall back to asset name when display_name is not a string', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { display_name: 123 }
      }
      expect(getAssetDisplayName(asset)).toBe('test-model')
    })

    it('should fall back to asset name when no metadata', () => {
      expect(getAssetDisplayName(mockAsset)).toBe('test-model')
    })
  })

  describe('getAssetSourceUrl', () => {
    it('should return source_url when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { source_url: 'https://civitai.com/models/123' }
      }
      expect(getAssetSourceUrl(asset)).toBe('https://civitai.com/models/123')
    })

    it('should return null when source_url is not a string', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { source_url: 123 }
      }
      expect(getAssetSourceUrl(asset)).toBeNull()
    })

    it('should return null when no metadata', () => {
      expect(getAssetSourceUrl(mockAsset)).toBeNull()
    })
  })

  describe('getAssetTriggerPhrases', () => {
    it('should return array of trigger phrases when array present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { trigger_phrases: ['phrase1', 'phrase2'] }
      }
      expect(getAssetTriggerPhrases(asset)).toEqual(['phrase1', 'phrase2'])
    })

    it('should wrap single string in array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { trigger_phrases: 'single phrase' }
      }
      expect(getAssetTriggerPhrases(asset)).toEqual(['single phrase'])
    })

    it('should filter non-string values from array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { trigger_phrases: ['valid', 123, 'also valid', null] }
      }
      expect(getAssetTriggerPhrases(asset)).toEqual(['valid', 'also valid'])
    })

    it('should return empty array when no metadata', () => {
      expect(getAssetTriggerPhrases(mockAsset)).toEqual([])
    })
  })

  describe('getAssetTags', () => {
    it('should return array of tags when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { tags: ['tag1', 'tag2'] }
      }
      expect(getAssetTags(asset)).toEqual(['tag1', 'tag2'])
    })

    it('should filter non-string values from array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { tags: ['valid', 123, 'also valid'] }
      }
      expect(getAssetTags(asset)).toEqual(['valid', 'also valid'])
    })

    it('should return empty array when tags is not an array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { tags: 'not an array' }
      }
      expect(getAssetTags(asset)).toEqual([])
    })

    it('should return empty array when no metadata', () => {
      expect(getAssetTags(mockAsset)).toEqual([])
    })
  })

  describe('getSourceName', () => {
    it('should return Civitai for civitai.com URLs', () => {
      expect(getSourceName('https://civitai.com/models/123')).toBe('Civitai')
    })

    it('should return Hugging Face for huggingface.co URLs', () => {
      expect(getSourceName('https://huggingface.co/org/model')).toBe(
        'Hugging Face'
      )
    })

    it('should return Source for unknown URLs', () => {
      expect(getSourceName('https://example.com/model')).toBe('Source')
    })
  })
})
