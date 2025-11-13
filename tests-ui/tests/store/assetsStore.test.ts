import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

// Mock isCloud to be true for these tests
vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

// Mock assetService
const mockGetAssetsForNodeType = vi.hoisted(() => vi.fn())

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetsForNodeType: mockGetAssetsForNodeType
  }
}))

const HASH_FILENAME =
  '72e786ff2a44d682c4294db0b7098e569832bc394efc6dad644e6ec85a78efb7.png'
const HASH_FILENAME_2 =
  'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456.jpg'

function createMockAssetItem(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'test-id',
    name: 'test.png',
    asset_hash: 'test-hash',
    size: 1024,
    tags: [],
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('assetsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('input asset mapping helpers', () => {
    it('should return name for valid asset_hash', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        createMockAssetItem({
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME
        }),
        createMockAssetItem({
          name: 'Mountain Vista.jpg',
          asset_hash: HASH_FILENAME_2
        })
      ]

      expect(store.getInputName(HASH_FILENAME)).toBe('Beautiful Sunset.png')
      expect(store.getInputName(HASH_FILENAME_2)).toBe('Mountain Vista.jpg')
    })

    it('should return original hash when no matching asset found', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        createMockAssetItem({
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME
        })
      ]

      const unknownHash =
        'fffffffffffffffffffffffffffuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu.png'
      expect(store.getInputName(unknownHash)).toBe(unknownHash)
    })

    it('should return hash as-is when no assets loaded', () => {
      const store = useAssetsStore()

      store.inputAssets = []

      expect(store.getInputName(HASH_FILENAME)).toBe(HASH_FILENAME)
    })

    it('should ignore assets without asset_hash', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        createMockAssetItem({
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME
        }),
        createMockAssetItem({
          name: 'No Hash Asset.jpg',
          asset_hash: null
        })
      ]

      // Should find first asset
      expect(store.getInputName(HASH_FILENAME)).toBe('Beautiful Sunset.png')
      // Map should only contain one entry
      expect(store.inputAssetsByFilename.size).toBe(1)
    })
  })

  describe('inputAssetsByFilename computed', () => {
    it('should create map keyed by asset_hash', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        createMockAssetItem({
          id: 'asset-123',
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME
        }),
        createMockAssetItem({
          id: 'asset-456',
          name: 'Mountain Vista.jpg',
          asset_hash: HASH_FILENAME_2
        })
      ]

      const map = store.inputAssetsByFilename

      expect(map.size).toBe(2)
      expect(map.get(HASH_FILENAME)).toMatchObject({
        id: 'asset-123',
        name: 'Beautiful Sunset.png',
        asset_hash: HASH_FILENAME
      })
      expect(map.get(HASH_FILENAME_2)).toMatchObject({
        id: 'asset-456',
        name: 'Mountain Vista.jpg',
        asset_hash: HASH_FILENAME_2
      })
    })

    it('should exclude assets with null/undefined hash from map', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        createMockAssetItem({
          name: 'Has Hash.png',
          asset_hash: HASH_FILENAME
        }),
        createMockAssetItem({
          name: 'Null Hash.jpg',
          asset_hash: null
        }),
        createMockAssetItem({
          name: 'Undefined Hash.jpg',
          asset_hash: undefined
        })
      ]

      const map = store.inputAssetsByFilename

      // Only asset with valid asset_hash should be in map
      expect(map.size).toBe(1)
      expect(map.has(HASH_FILENAME)).toBe(true)
    })

    it('should return empty map when no assets loaded', () => {
      const store = useAssetsStore()

      store.inputAssets = []

      expect(store.inputAssetsByFilename.size).toBe(0)
    })
  })

  describe('model assets caching', () => {
    beforeEach(() => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()
    })

    it('should cache assets by node type', async () => {
      const store = useAssetsStore()
      const mockAssets: AssetItem[] = [
        createMockAssetItem({ id: '1', name: 'model_a.safetensors' }),
        createMockAssetItem({ id: '2', name: 'model_b.safetensors' })
      ]
      mockGetAssetsForNodeType.mockResolvedValue(mockAssets)

      await store.updateModelsForNodeType('CheckpointLoaderSimple')

      expect(mockGetAssetsForNodeType).toHaveBeenCalledWith(
        'CheckpointLoaderSimple'
      )
      expect(store.modelAssetsByNodeType.get('CheckpointLoaderSimple')).toEqual(
        mockAssets
      )
    })

    it('should track loading state', async () => {
      const store = useAssetsStore()
      mockGetAssetsForNodeType.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      )

      const promise = store.updateModelsForNodeType('LoraLoader')

      expect(store.modelLoadingByNodeType.get('LoraLoader')).toBe(true)

      await promise

      expect(store.modelLoadingByNodeType.get('LoraLoader')).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      const store = useAssetsStore()
      const mockError = new Error('Network error')
      mockGetAssetsForNodeType.mockRejectedValue(mockError)

      await store.updateModelsForNodeType('VAELoader')

      expect(store.modelErrorByNodeType.get('VAELoader')).toBe(mockError)
      expect(store.modelAssetsByNodeType.get('VAELoader')).toEqual([])
      expect(store.modelLoadingByNodeType.get('VAELoader')).toBe(false)
    })
  })
})
