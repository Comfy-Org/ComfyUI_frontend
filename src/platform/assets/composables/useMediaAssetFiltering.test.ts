import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useMediaAssetFiltering } from '@/platform/assets/composables/useMediaAssetFiltering'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

interface AssetSpec {
  id: string
  name: string
  displayName?: string
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
    display_name: spec.displayName,
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
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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
      vi.useFakeTimers()
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

      expect(ids(filtering.filteredAssets.value)).toEqual(['later', 'midnight'])
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
        'recent',
        'boundary'
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

  describe('name sort', () => {
    function namedAssets() {
      return ref<AssetItem[]>([
        makeAsset({ id: 'fallback', name: 'banana.png' }),
        makeAsset({
          id: 'display-z',
          name: 'a.png',
          displayName: 'Zebra'
        }),
        makeAsset({
          id: 'display-a',
          name: 'z.png',
          displayName: 'apple'
        })
      ])
    }

    it('sorts A → Z by display name, falling back to name and ignoring case', () => {
      const assets = namedAssets()
      const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

      sortBy.value = 'az'

      expect(ids(filteredAssets.value)).toEqual([
        'display-a',
        'fallback',
        'display-z'
      ])
      expect(ids(assets.value)).toEqual(['fallback', 'display-z', 'display-a'])
    })

    it('sorts Z → A by display name, falling back to name and ignoring case', () => {
      const { sortBy, filteredAssets } = useMediaAssetFiltering(namedAssets())

      sortBy.value = 'za'

      expect(ids(filteredAssets.value)).toEqual([
        'display-z',
        'fallback',
        'display-a'
      ])
    })

    it.for(['az', 'za'] as const)(
      'preserves source order for case-only ties when sorting %s',
      (direction) => {
        const assets = ref<AssetItem[]>([
          makeAsset({
            id: 'case-first',
            name: 'z-case.png',
            displayName: 'ALPHA'
          }),
          makeAsset({
            id: 'case-second',
            name: 'a-case.png',
            displayName: 'alpha'
          })
        ])
        const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

        sortBy.value = direction

        expect(ids(filteredAssets.value)).toEqual(['case-first', 'case-second'])
      }
    )

    it.for([
      ['az', ['file-2', 'file-10']],
      ['za', ['file-10', 'file-2']]
    ] as const)(
      'sorts numeric filenames naturally when sorting %s',
      ([direction, expected]) => {
        const assets = ref<AssetItem[]>([
          makeAsset({ id: 'file-10', name: 'file_10.png' }),
          makeAsset({ id: 'file-2', name: 'file_2.png' })
        ])
        const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

        sortBy.value = direction

        expect(ids(filteredAssets.value)).toEqual(expected)
      }
    )
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

    it('combines media type and date before sorting', () => {
      vi.useFakeTimers()
      const now = new Date(2026, 6, 27, 12).getTime()
      vi.setSystemTime(now)

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
      first.sortBy.value = 'oldest'
      firstScope.stop()

      const secondScope = effectScope()
      const second = secondScope.run(() => useMediaAssetFiltering(assets))!

      expect(second.mediaTypeFilters.value).toEqual(['image'])
      expect(second.dateFilter.value).toBe('week')
      expect(second.searchQuery.value).toBe('')
      expect(second.sortBy.value).toBe('newest')
      secondScope.stop()
    })
  })
})
