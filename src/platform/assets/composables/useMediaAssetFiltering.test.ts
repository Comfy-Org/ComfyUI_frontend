import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

interface AssetSpec {
  id: string
  name: string
  /** Unix ms; written into both `created_at` (ISO) and `user_metadata.create_time`. */
  createTime?: number
  /** Seconds, written into `user_metadata.executionTimeInSeconds`. */
  executionSeconds?: number
}

function makeAsset(spec: AssetSpec): AssetItem {
  const userMetadata: Record<string, unknown> = {}
  if (spec.createTime !== undefined) {
    userMetadata.create_time = spec.createTime
  }
  if (spec.executionSeconds !== undefined) {
    userMetadata.executionTimeInSeconds = spec.executionSeconds
  }
  return {
    id: spec.id,
    name: spec.name,
    tags: [],
    created_at:
      spec.createTime !== undefined
        ? new Date(spec.createTime).toISOString()
        : undefined,
    user_metadata: userMetadata
  }
}

function ids(assets: AssetItem[]): string[] {
  return assets.map((a) => a.id)
}

describe('useMediaAssetFiltering', () => {
  describe('media-type filter', () => {
    it('returns all assets when no filters are selected', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'a', name: 'a.png' }),
        makeAsset({ id: 'b', name: 'b.mp4' }),
        makeAsset({ id: 'c', name: 'c.glb' })
      ])
      const { filteredAssets } = useMediaAssetFiltering(assets)

      expect(ids(filteredAssets.value).sort()).toEqual(['a', 'b', 'c'])
    })

    it('filters to a single media kind', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'img', name: 'img.png' }),
        makeAsset({ id: 'vid', name: 'vid.mp4' }),
        makeAsset({ id: 'aud', name: 'aud.wav' }),
        makeAsset({ id: '3d', name: 'model.glb' })
      ])
      const { mediaTypeFilters, filteredAssets } =
        useMediaAssetFiltering(assets)

      mediaTypeFilters.value = ['video']
      expect(ids(filteredAssets.value)).toEqual(['vid'])
    })

    it('combines multiple kinds via OR', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'img', name: 'img.png' }),
        makeAsset({ id: 'vid', name: 'vid.mp4' }),
        makeAsset({ id: 'aud', name: 'aud.wav' })
      ])
      const { mediaTypeFilters, filteredAssets } =
        useMediaAssetFiltering(assets)

      mediaTypeFilters.value = ['image', 'audio']
      expect(ids(filteredAssets.value).sort()).toEqual(['aud', 'img'])
    })

    it("normalizes '3D' filename detection to lowercase '3d' for filter match", () => {
      // getMediaTypeFromFilename returns '3D' for .glb, but the filter array
      // stores the lowercase '3d' the menu emits — composable must reconcile.
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'img', name: 'img.png' }),
        makeAsset({ id: 'mesh', name: 'mesh.glb' })
      ])
      const { mediaTypeFilters, filteredAssets } =
        useMediaAssetFiltering(assets)

      mediaTypeFilters.value = ['3d']
      expect(ids(filteredAssets.value)).toEqual(['mesh'])
    })

    it('excludes unsupported media kinds (e.g. text) when any filter is active', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'img', name: 'img.png' }),
        makeAsset({ id: 'doc', name: 'notes.txt' })
      ])
      const { mediaTypeFilters, filteredAssets } =
        useMediaAssetFiltering(assets)

      mediaTypeFilters.value = ['image']
      expect(ids(filteredAssets.value)).toEqual(['img'])
    })
  })

  describe('sort', () => {
    const t1 = 1_000_000
    const t2 = 2_000_000
    const t3 = 3_000_000

    it('defaults to newest first by create_time descending', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'old', name: 'a.png', createTime: t1 }),
        makeAsset({ id: 'mid', name: 'b.png', createTime: t2 }),
        makeAsset({ id: 'new', name: 'c.png', createTime: t3 })
      ])
      const { filteredAssets } = useMediaAssetFiltering(assets)

      expect(ids(filteredAssets.value)).toEqual(['new', 'mid', 'old'])
    })

    it('sorts oldest first by create_time ascending', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'new', name: 'c.png', createTime: t3 }),
        makeAsset({ id: 'old', name: 'a.png', createTime: t1 }),
        makeAsset({ id: 'mid', name: 'b.png', createTime: t2 })
      ])
      const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

      sortBy.value = 'oldest'
      expect(ids(filteredAssets.value)).toEqual(['old', 'mid', 'new'])
    })

    it('sorts longest by executionTimeInSeconds descending', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'fast', name: 'a.png', executionSeconds: 3 }),
        makeAsset({ id: 'slow', name: 'b.png', executionSeconds: 10 }),
        makeAsset({ id: 'mid', name: 'c.png', executionSeconds: 5 })
      ])
      const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

      sortBy.value = 'longest'
      expect(ids(filteredAssets.value)).toEqual(['slow', 'mid', 'fast'])
    })

    it('sorts fastest by executionTimeInSeconds ascending', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'fast', name: 'a.png', executionSeconds: 3 }),
        makeAsset({ id: 'slow', name: 'b.png', executionSeconds: 10 }),
        makeAsset({ id: 'mid', name: 'c.png', executionSeconds: 5 })
      ])
      const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

      sortBy.value = 'fastest'
      expect(ids(filteredAssets.value)).toEqual(['fast', 'mid', 'slow'])
    })

    it('falls back to created_at when user_metadata.create_time is absent', () => {
      const a = makeAsset({ id: 'a', name: 'a.png', createTime: t1 })
      const b = makeAsset({ id: 'b', name: 'b.png', createTime: t2 })
      // Strip the user_metadata.create_time path on both, leaving created_at.
      a.user_metadata = {}
      b.user_metadata = {}
      const assets = ref<AssetItem[]>([a, b])
      const { filteredAssets } = useMediaAssetFiltering(assets)

      expect(ids(filteredAssets.value)).toEqual(['b', 'a'])
    })
  })

  describe('composition', () => {
    it('applies media-type filter then sort', () => {
      const t1 = 1_000_000
      const t2 = 2_000_000
      const t3 = 3_000_000
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'img-old', name: 'a.png', createTime: t1 }),
        makeAsset({ id: 'vid', name: 'b.mp4', createTime: t2 }),
        makeAsset({ id: 'img-new', name: 'c.png', createTime: t3 })
      ])
      const { mediaTypeFilters, sortBy, filteredAssets } =
        useMediaAssetFiltering(assets)

      mediaTypeFilters.value = ['image']
      sortBy.value = 'oldest'

      expect(ids(filteredAssets.value)).toEqual(['img-old', 'img-new'])
    })
  })
})
