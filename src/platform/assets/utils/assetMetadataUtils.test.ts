import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModel,
  getAssetDescription
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
})
