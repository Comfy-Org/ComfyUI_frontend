import { describe, expect, it } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetBaseModel,
  getAssetDescription,
  getAssetFilename,
  validateAssetFilename
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

  describe('getAssetFilename', () => {
    it('should return trimmed filename when present', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { filename: ' checkpoints/model.safetensors ' }
      }
      expect(getAssetFilename(asset)).toBe('checkpoints/model.safetensors')
    })

    it('should return null when filename is empty string', () => {
      const asset = {
        ...mockAsset,
        user_metadata: { filename: '   ' }
      }
      expect(getAssetFilename(asset)).toBeNull()
    })

    it('should return null when no metadata', () => {
      expect(getAssetFilename(mockAsset)).toBeNull()
    })
  })

  describe('validateAssetFilename', () => {
    it('should accept valid filenames', () => {
      expect(validateAssetFilename('model.safetensors')).toBe(true)
      expect(validateAssetFilename('checkpoints/model.safetensors')).toBe(true)
      expect(validateAssetFilename('loras/style/anime.safetensors')).toBe(true)
    })

    it('should reject directory traversal attempts', () => {
      expect(validateAssetFilename('../../../etc/passwd')).toBe(false)
      expect(validateAssetFilename('models/../../../secret.txt')).toBe(false)
    })

    it('should reject dangerous characters', () => {
      expect(validateAssetFilename('model<script>.safetensors')).toBe(false)
      expect(validateAssetFilename('model|pipe.safetensors')).toBe(false)
      expect(validateAssetFilename('model*wildcard.safetensors')).toBe(false)
    })

    it('should reject empty or whitespace-only strings', () => {
      expect(validateAssetFilename('')).toBe(false)
      expect(validateAssetFilename('   ')).toBe(false)
    })
  })
})
