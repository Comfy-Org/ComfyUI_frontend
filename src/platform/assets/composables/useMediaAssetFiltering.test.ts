import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

interface AssetSpec {
  id: string
  name: string
  displayName?: string
  /** Unix ms; written into both `created_at` (ISO) and `user_metadata.create_time`. */
  createTime?: number
}

function makeAsset(spec: AssetSpec): AssetItem {
  const userMetadata: Record<string, unknown> = {}
  if (spec.createTime !== undefined) {
    userMetadata.create_time = spec.createTime
  }
  return fromPartial({
    id: spec.id,
    name: spec.name,
    display_name: spec.displayName,
    tags: [],
    created_at:
      spec.createTime !== undefined
        ? new Date(spec.createTime).toISOString()
        : undefined,
    user_metadata: userMetadata
  })
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

  describe('date filter', () => {
    const now = new Date(2026, 6, 27, 12).getTime()

    beforeEach(() => {
      vi.setSystemTime(now)
    })

    it('includes local midnight and excludes earlier assets for Today', () => {
      const midnight = new Date(2026, 6, 27).getTime()
      const assets = ref<AssetItem[]>([
        makeAsset({
          id: 'before',
          name: 'before.png',
          createTime: midnight - 1
        }),
        makeAsset({
          id: 'midnight',
          name: 'midnight.png',
          createTime: midnight
        }),
        makeAsset({ id: 'later', name: 'later.png', createTime: now })
      ])
      const filtering = useMediaAssetFiltering(assets)

      filtering.dateFilter.value = 'today'

      expect(ids(filtering.filteredAssets.value)).toEqual(['midnight', 'later'])
    })

    it.for([
      { filter: 'week' as const, days: 7 },
      { filter: 'month' as const, days: 30 }
    ])('includes the exact $days-day boundary', ({ filter, days }) => {
      const boundary = now - days * 86_400_000
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'older', name: 'older.png', createTime: boundary - 1 }),
        makeAsset({
          id: 'boundary',
          name: 'boundary.png',
          createTime: boundary
        }),
        makeAsset({ id: 'recent', name: 'recent.png', createTime: now })
      ])
      const filtering = useMediaAssetFiltering(assets)

      filtering.dateFilter.value = filter

      expect(ids(filtering.filteredAssets.value)).toEqual([
        'boundary',
        'recent'
      ])
    })

    it('includes local January 1 and excludes the previous year', () => {
      const yearStart = new Date(2026, 0, 1).getTime()
      const assets = ref<AssetItem[]>([
        makeAsset({
          id: 'last-year',
          name: 'last-year.png',
          createTime: yearStart - 1
        }),
        makeAsset({
          id: 'year-start',
          name: 'year-start.png',
          createTime: yearStart
        })
      ])
      const filtering = useMediaAssetFiltering(assets)

      filtering.dateFilter.value = 'year'

      expect(ids(filtering.filteredAssets.value)).toEqual(['year-start'])
    })

    it('uses created_at when create_time is absent', () => {
      const imported = makeAsset({
        id: 'imported',
        name: 'imported.png',
        createTime: now
      })
      imported.user_metadata = {}
      const assets = ref<AssetItem[]>([
        imported,
        makeAsset({
          id: 'old-output',
          name: 'old-output.png',
          createTime: now - 31 * 86_400_000
        })
      ])
      const filtering = useMediaAssetFiltering(assets)

      filtering.dateFilter.value = 'month'

      expect(ids(filtering.filteredAssets.value)).toEqual(['imported'])
    })
  })

  describe('composition', () => {
    it('keeps the source order of the assets it filters', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'img-old', name: 'z.png', createTime: 1_000_000 }),
        makeAsset({ id: 'vid', name: 'b.mp4', createTime: 2_000_000 }),
        makeAsset({ id: 'img-new', name: 'a.png', createTime: 3_000_000 })
      ])
      const { mediaTypeFilters, filteredAssets } =
        useMediaAssetFiltering(assets)

      mediaTypeFilters.value = ['image']

      expect(ids(filteredAssets.value)).toEqual(['img-old', 'img-new'])
    })

    it('combines media type and date filters', () => {
      const now = Date.now()

      const assets = ref<AssetItem[]>([
        makeAsset({
          id: 'recent-image',
          name: 'recent.png',
          createTime: now
        }),
        makeAsset({
          id: 'old-image',
          name: 'old.png',
          createTime: now - 31 * 86_400_000
        }),
        makeAsset({
          id: 'recent-video',
          name: 'recent.mp4',
          createTime: now - 1
        })
      ])
      const filtering = useMediaAssetFiltering(assets)

      filtering.mediaTypeFilters.value = ['image']
      filtering.dateFilter.value = 'month'

      expect(ids(filtering.filteredAssets.value)).toEqual(['recent-image'])
    })
  })

  describe('state lifetime', () => {
    it('preserves applied filters across consumer remounts', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'image', name: 'image.png' }),
        makeAsset({ id: 'video', name: 'video.mp4' })
      ])
      const firstScope = effectScope()
      const first = firstScope.run(() => useMediaAssetFiltering(assets))!

      first.mediaTypeFilters.value = ['image']
      first.dateFilter.value = 'week'
      first.searchQuery.value = 'image'
      firstScope.stop()

      const secondScope = effectScope()
      const second = secondScope.run(() => useMediaAssetFiltering(assets))!

      expect(second.mediaTypeFilters.value).toEqual(['image'])
      expect(second.dateFilter.value).toBe('week')
      expect(second.searchQuery.value).toBe('')
      secondScope.stop()
    })
  })
})
