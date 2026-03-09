import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { AssetItem } from '../schemas/assetSchema'
import { useMediaAssetGalleryStore } from './useMediaAssetGalleryStore'

describe('useMediaAssetGalleryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('openSingle', () => {
    it('should set items and activeIndex', () => {
      const store = useMediaAssetGalleryStore()
      const asset: AssetItem = {
        id: 'test-1',
        name: 'test-image.png',
        size: 1024,
        preview_url: 'https://example.com/image.png',
        tags: ['output'],
        created_at: '2025-01-01'
      }

      store.openSingle(asset)

      expect(store.items).toHaveLength(1)
      expect(store.items[0]).toBe(asset)
      expect(store.activeIndex).toBe(0)
    })

    it('should preserve asset properties', () => {
      const store = useMediaAssetGalleryStore()
      const asset: AssetItem = {
        id: 'test-2',
        name: 'test-video.mp4',
        size: 2048,
        preview_url: 'https://example.com/video.mp4',
        tags: ['output'],
        created_at: '2025-01-01'
      }

      store.openSingle(asset)

      expect(store.items[0].name).toBe('test-video.mp4')
      expect(store.items[0].preview_url).toBe('https://example.com/video.mp4')
    })

    it('should replace previous items when called multiple times', () => {
      const store = useMediaAssetGalleryStore()
      const asset1: AssetItem = {
        id: '1',
        name: 'first.png',
        size: 100,
        preview_url: 'url1',
        tags: [],
        created_at: '2025-01-01'
      }
      const asset2: AssetItem = {
        id: '2',
        name: 'second.png',
        size: 200,
        preview_url: 'url2',
        tags: [],
        created_at: '2025-01-01'
      }

      store.openSingle(asset1)
      expect(store.items).toHaveLength(1)
      expect(store.items[0].name).toBe('first.png')

      store.openSingle(asset2)
      expect(store.items).toHaveLength(1)
      expect(store.items[0].name).toBe('second.png')
      expect(store.activeIndex).toBe(0)
    })
  })

  describe('close', () => {
    it('should reset activeIndex to -1', () => {
      const store = useMediaAssetGalleryStore()
      const asset: AssetItem = {
        id: 'test',
        name: 'test.png',
        size: 1024,
        preview_url: 'test-url',
        tags: [],
        created_at: '2025-01-01'
      }

      store.openSingle(asset)
      expect(store.activeIndex).toBe(0)

      store.close()
      expect(store.activeIndex).toBe(-1)
    })
  })
})
