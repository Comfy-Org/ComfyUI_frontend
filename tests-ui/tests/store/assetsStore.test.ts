import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAssetsStore } from '@/stores/assetsStore'

const HASH_FILENAME =
  '72e786ff2a44d682c4294db0b7098e569832bc394efc6dad644e6ec85a78efb7.png'
const HASH_FILENAME_2 =
  'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456.jpg'

describe('assetsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('input asset mapping helpers', () => {
    it('should return name for valid asset_hash', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        {
          id: 'asset-123',
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME,
          size: 120230,
          created_at: '2024-01-01'
        },
        {
          id: 'asset-456',
          name: 'Mountain Vista.jpg',
          asset_hash: HASH_FILENAME_2,
          size: 256000,
          created_at: '2024-01-02'
        }
      ] as any

      expect(store.getInputName(HASH_FILENAME)).toBe('Beautiful Sunset.png')
      expect(store.getInputName(HASH_FILENAME_2)).toBe('Mountain Vista.jpg')
    })

    it('should return hash filename when asset not found', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        {
          id: 'asset-123',
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME,
          size: 120230,
          created_at: '2024-01-01'
        }
      ] as any

      const unknownHash =
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.png'
      expect(store.getInputName(unknownHash)).toBe(unknownHash)
    })

    it('should handle empty asset list', () => {
      const store = useAssetsStore()

      store.inputAssets = []

      expect(store.getInputName(HASH_FILENAME)).toBe(HASH_FILENAME)
    })

    it('should ignore assets without asset_hash', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        {
          id: 'asset-123',
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME,
          size: 120230,
          created_at: '2024-01-01'
        },
        {
          id: 'asset-456',
          name: 'No Hash Asset.jpg',
          asset_hash: null,
          size: 256000,
          created_at: '2024-01-02'
        }
      ] as any

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
        {
          id: 'asset-123',
          name: 'Beautiful Sunset.png',
          asset_hash: HASH_FILENAME,
          size: 120230,
          created_at: '2024-01-01'
        },
        {
          id: 'asset-456',
          name: 'Mountain Vista.jpg',
          asset_hash: HASH_FILENAME_2,
          size: 256000,
          created_at: '2024-01-02'
        }
      ] as any

      const map = store.inputAssetsByFilename

      expect(map.size).toBe(2)
      expect(map.get(HASH_FILENAME)).toEqual({
        id: 'asset-123',
        name: 'Beautiful Sunset.png',
        asset_hash: HASH_FILENAME,
        size: 120230,
        created_at: '2024-01-01'
      })
      expect(map.get(HASH_FILENAME_2)).toEqual({
        id: 'asset-456',
        name: 'Mountain Vista.jpg',
        asset_hash: HASH_FILENAME_2,
        size: 256000,
        created_at: '2024-01-02'
      })
    })

    it('should handle undefined/null asset_hash values', () => {
      const store = useAssetsStore()

      store.inputAssets = [
        {
          id: 'asset-123',
          name: 'Has Hash.png',
          asset_hash: HASH_FILENAME,
          size: 120230,
          created_at: '2024-01-01'
        },
        {
          id: 'asset-456',
          name: 'Null Hash.jpg',
          asset_hash: null,
          size: 256000,
          created_at: '2024-01-02'
        },
        {
          id: 'asset-789',
          name: 'Undefined Hash.jpg',
          size: 256000,
          created_at: '2024-01-03'
        }
      ] as any

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
})
