import { describe, expect, it } from 'vitest'

import { useAssetFilterOptions } from '@/platform/assets/composables/useAssetFilterOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

// Test factory functions
function createTestAsset(overrides: Partial<AssetItem> = {}): AssetItem {
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
    user_metadata: {
      base_model: 'sd15'
    },
    ...overrides
  }
}

describe('useAssetFilterOptions', () => {
  describe('File Format Extraction', () => {
    it('extracts file formats from asset names', () => {
      const assets = [
        createTestAsset({ name: 'model1.safetensors' }),
        createTestAsset({ name: 'model2.ckpt' }),
        createTestAsset({ name: 'model3.pt' })
      ]

      const { availableFileFormats } = useAssetFilterOptions(assets)

      expect(availableFileFormats.value).toEqual([
        { name: '.ckpt', value: 'ckpt' },
        { name: '.pt', value: 'pt' },
        { name: '.safetensors', value: 'safetensors' }
      ])
    })

    it('handles duplicate file formats', () => {
      const assets = [
        createTestAsset({ name: 'model1.safetensors' }),
        createTestAsset({ name: 'model2.safetensors' }),
        createTestAsset({ name: 'model3.ckpt' })
      ]

      const { availableFileFormats } = useAssetFilterOptions(assets)

      expect(availableFileFormats.value).toEqual([
        { name: '.ckpt', value: 'ckpt' },
        { name: '.safetensors', value: 'safetensors' }
      ])
    })

    it('handles assets with no file extension', () => {
      const assets = [
        createTestAsset({ name: 'model_no_extension' }),
        createTestAsset({ name: 'model.safetensors' })
      ]

      const { availableFileFormats } = useAssetFilterOptions(assets)

      expect(availableFileFormats.value).toEqual([
        { name: '.safetensors', value: 'safetensors' }
      ])
    })

    it('handles empty asset list', () => {
      const { availableFileFormats } = useAssetFilterOptions([])

      expect(availableFileFormats.value).toEqual([])
    })
  })

  describe('Base Model Extraction', () => {
    it('extracts base models from user metadata', () => {
      const assets = [
        createTestAsset({ user_metadata: { base_model: 'sd15' } }),
        createTestAsset({ user_metadata: { base_model: 'sdxl' } }),
        createTestAsset({ user_metadata: { base_model: 'sd35' } })
      ]

      const { availableBaseModels } = useAssetFilterOptions(assets)

      expect(availableBaseModels.value).toEqual([
        { name: 'sd15', value: 'sd15' },
        { name: 'sd35', value: 'sd35' },
        { name: 'sdxl', value: 'sdxl' }
      ])
    })

    it('handles duplicate base models', () => {
      const assets = [
        createTestAsset({ user_metadata: { base_model: 'sd15' } }),
        createTestAsset({ user_metadata: { base_model: 'sd15' } }),
        createTestAsset({ user_metadata: { base_model: 'sdxl' } })
      ]

      const { availableBaseModels } = useAssetFilterOptions(assets)

      expect(availableBaseModels.value).toEqual([
        { name: 'sd15', value: 'sd15' },
        { name: 'sdxl', value: 'sdxl' }
      ])
    })

    it('handles assets with missing user_metadata', () => {
      const assets = [
        createTestAsset({ user_metadata: undefined }),
        createTestAsset({ user_metadata: { base_model: 'sd15' } })
      ]

      const { availableBaseModels } = useAssetFilterOptions(assets)

      expect(availableBaseModels.value).toEqual([
        { name: 'sd15', value: 'sd15' }
      ])
    })

    it('handles assets with missing base_model field', () => {
      const assets = [
        createTestAsset({ user_metadata: { description: 'A test model' } }),
        createTestAsset({ user_metadata: { base_model: 'sdxl' } })
      ]

      const { availableBaseModels } = useAssetFilterOptions(assets)

      expect(availableBaseModels.value).toEqual([
        { name: 'sdxl', value: 'sdxl' }
      ])
    })

    it('handles empty asset list', () => {
      const { availableBaseModels } = useAssetFilterOptions([])

      expect(availableBaseModels.value).toEqual([])
    })
  })

  describe('Reactivity', () => {
    it('returns computed properties that can be reactive', () => {
      const assets = [createTestAsset({ name: 'model.safetensors' })]

      const { availableFileFormats, availableBaseModels } =
        useAssetFilterOptions(assets)

      // These should be computed refs
      expect(availableFileFormats.value).toBeDefined()
      expect(availableBaseModels.value).toBeDefined()
      expect(typeof availableFileFormats.value).toBe('object')
      expect(typeof availableBaseModels.value).toBe('object')
      expect(Array.isArray(availableFileFormats.value)).toBe(true)
      expect(Array.isArray(availableBaseModels.value)).toBe(true)
    })
  })
})
