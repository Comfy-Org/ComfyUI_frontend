import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it } from 'vitest'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import { useMediaAssetGalleryStore } from './useMediaAssetGalleryStore'

describe('useMediaAssetGalleryStore', () => {
  describe('openSingle', () => {
    it('should convert AssetMeta to result item data', () => {
      const store = useMediaAssetGalleryStore()
      const mockAsset = fromPartial<AssetMeta>({
        id: 'test-1',
        name: 'test-image.png',
        kind: 'image',
        src: 'https://example.com/image.png',
        size: 1024,
        tags: [],
        created_at: '2025-01-01'
      })

      store.openSingle(mockAsset)

      expect(store.items).toHaveLength(1)
      expect(store.items[0]).toEqual({
        filename: 'test-image.png',
        subfolder: '',
        type: 'output',
        nodeId: '0',
        mediaType: 'images',
        url: 'https://example.com/image.png'
      })
      expect(store.activeIndex).toBe(0)
    })

    it('should set correct mediaType for video assets', () => {
      const store = useMediaAssetGalleryStore()
      const mockVideoAsset = fromPartial<AssetMeta>({
        id: 'test-2',
        name: 'test-video.mp4',
        kind: 'video',
        src: 'https://example.com/video.mp4',
        size: 2048,
        tags: [],
        created_at: '2025-01-01'
      })

      store.openSingle(mockVideoAsset)

      expect(store.items[0]).toMatchObject({
        filename: 'test-video.mp4',
        mediaType: 'video'
      })
    })

    it('should set correct mediaType for audio assets', () => {
      const store = useMediaAssetGalleryStore()
      const mockAudioAsset = fromPartial<AssetMeta>({
        id: 'test-3',
        name: 'test-audio.mp3',
        kind: 'audio',
        src: 'https://example.com/audio.mp3',
        size: 512,
        tags: [],
        created_at: '2025-01-01'
      })

      store.openSingle(mockAudioAsset)

      expect(store.items[0]).toMatchObject({
        filename: 'test-audio.mp3',
        mediaType: 'audio'
      })
    })

    it('should use asset.src as the url', () => {
      const store = useMediaAssetGalleryStore()
      const mockAsset = fromPartial<AssetMeta>({
        id: 'test-4',
        name: 'test.png',
        kind: 'image',
        src: 'https://example.com/custom-url.png',
        size: 1024,
        tags: [],
        created_at: '2025-01-01'
      })

      store.openSingle(mockAsset)

      expect(store.items[0].url).toBe('https://example.com/custom-url.png')
    })

    it('should handle assets without src gracefully', () => {
      const store = useMediaAssetGalleryStore()
      const mockAsset = fromPartial<AssetMeta>({
        id: 'test-5',
        name: 'no-src.png',
        kind: 'image',
        src: '',
        size: 1024,
        tags: [],
        created_at: '2025-01-01'
      })

      store.openSingle(mockAsset)

      expect(store.items[0].url).toBe('')
    })

    it('should update activeIndex and items when called multiple times', () => {
      const store = useMediaAssetGalleryStore()
      const asset1 = fromPartial<AssetMeta>({
        id: '1',
        name: 'first.png',
        kind: 'image',
        src: 'url1',
        size: 100,
        tags: [],
        created_at: '2025-01-01'
      })
      const asset2 = fromPartial<AssetMeta>({
        id: '2',
        name: 'second.png',
        kind: 'image',
        src: 'url2',
        size: 200,
        tags: [],
        created_at: '2025-01-01'
      })

      store.openSingle(asset1)
      expect(store.items).toHaveLength(1)
      expect(store.items[0].filename).toBe('first.png')

      store.openSingle(asset2)
      expect(store.items).toHaveLength(1)
      expect(store.items[0].filename).toBe('second.png')
      expect(store.activeIndex).toBe(0)
    })
  })

  describe('close', () => {
    it('should reset activeIndex to -1', () => {
      const store = useMediaAssetGalleryStore()
      const mockAsset = fromPartial<AssetMeta>({
        id: 'test',
        name: 'test.png',
        kind: 'image',
        src: 'test-url',
        size: 1024,
        tags: [],
        created_at: '2025-01-01'
      })

      store.openSingle(mockAsset)
      expect(store.activeIndex).toBe(0)

      store.close()
      expect(store.activeIndex).toBe(-1)
    })
  })
})
