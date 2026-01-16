import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetAdditionalTags,
  getAssetBaseModel,
  getAssetDescription,
  getAssetDisplayName,
  getAssetSourceUrl,
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
    it('should return name from user_metadata when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { name: 'My Custom Name' }
      }
      expect(getAssetDisplayName(asset)).toBe('My Custom Name')
    })

    it('should fall back to asset name when user_metadata.name is not a string', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { name: 123 }
      }
      expect(getAssetDisplayName(asset)).toBe('test-model')
    })

    it('should fall back to asset name when no metadata', () => {
      expect(getAssetDisplayName(mockAsset)).toBe('test-model')
    })
  })

  describe('getAssetSourceUrl', () => {
    it('should construct URL from source_arn with civitai format', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { source_arn: 'civitai:model:123:version:456' }
      }
      expect(getAssetSourceUrl(asset)).toBe(
        'https://civitai.com/models/123?modelVersionId=456'
      )
    })

    it('should return null when source_arn is not a string', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { source_arn: 123 }
      }
      expect(getAssetSourceUrl(asset)).toBeNull()
    })

    it('should return null when source_arn format is not recognized', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { source_arn: 'unknown:format' }
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
        user_metadata: { trained_words: ['phrase1', 'phrase2'] }
      }
      expect(getAssetTriggerPhrases(asset)).toEqual(['phrase1', 'phrase2'])
    })

    it('should wrap single string in array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { trained_words: 'single phrase' }
      }
      expect(getAssetTriggerPhrases(asset)).toEqual(['single phrase'])
    })

    it('should filter non-string values from array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { trained_words: ['valid', 123, 'also valid', null] }
      }
      expect(getAssetTriggerPhrases(asset)).toEqual(['valid', 'also valid'])
    })

    it('should return empty array when no metadata', () => {
      expect(getAssetTriggerPhrases(mockAsset)).toEqual([])
    })
  })

  describe('getAssetAdditionalTags', () => {
    it('should return array of tags when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { additional_tags: ['tag1', 'tag2'] }
      }
      expect(getAssetAdditionalTags(asset)).toEqual(['tag1', 'tag2'])
    })

    it('should filter non-string values from array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { additional_tags: ['valid', 123, 'also valid'] }
      }
      expect(getAssetAdditionalTags(asset)).toEqual(['valid', 'also valid'])
    })

    it('should return empty array when additional_tags is not an array', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { additional_tags: 'not an array' }
      }
      expect(getAssetAdditionalTags(asset)).toEqual([])
    })

    it('should return empty array when no metadata', () => {
      expect(getAssetAdditionalTags(mockAsset)).toEqual([])
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
