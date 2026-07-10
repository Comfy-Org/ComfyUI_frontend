import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

import { useAssetVisibilityStore } from '@/platform/assets/composables/useAssetVisibilityStore'
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
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    distribution.isCloud = false
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

  describe('alphabetical sort', () => {
    it('sorts A→Z by display name (case-insensitive)', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'b', name: 'banana.png' }),
        makeAsset({ id: 'a', name: 'Apple.png' }),
        makeAsset({ id: 'c', name: 'cherry.png' })
      ])
      const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

      sortBy.value = 'az'
      expect(ids(filteredAssets.value)).toEqual(['a', 'b', 'c'])
    })

    it('sorts Z→A by display name (case-insensitive)', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'b', name: 'banana.png' }),
        makeAsset({ id: 'a', name: 'Apple.png' }),
        makeAsset({ id: 'c', name: 'cherry.png' })
      ])
      const { sortBy, filteredAssets } = useMediaAssetFiltering(assets)

      sortBy.value = 'za'
      expect(ids(filteredAssets.value)).toEqual(['c', 'b', 'a'])
    })
  })

  describe('visibility filter', () => {
    beforeEach(() => {
      distribution.isCloud = true
    })

    function twoAssets() {
      return ref<AssetItem[]>([
        makeAsset({ id: 'shared', name: 'a.png' }),
        makeAsset({ id: 'private', name: 'b.png' })
      ])
    }

    it('returns every asset when set to all', () => {
      const { visibilityFilter, filteredAssets } =
        useMediaAssetFiltering(twoAssets())

      useAssetVisibilityStore().share(['shared'])
      visibilityFilter.value = 'all'
      expect(ids(filteredAssets.value).sort()).toEqual(['private', 'shared'])
    })

    it('keeps only shared assets when set to shared', () => {
      const { visibilityFilter, filteredAssets } =
        useMediaAssetFiltering(twoAssets())

      useAssetVisibilityStore().share(['shared'])
      visibilityFilter.value = 'shared'
      expect(ids(filteredAssets.value)).toEqual(['shared'])
    })

    it('keeps only private assets when set to private', () => {
      const { visibilityFilter, filteredAssets } =
        useMediaAssetFiltering(twoAssets())

      useAssetVisibilityStore().share(['shared'])
      visibilityFilter.value = 'private'
      expect(ids(filteredAssets.value)).toEqual(['private'])
    })
  })

  describe('author filter', () => {
    it('returns every asset when no author is selected', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'a', name: 'a.png' }),
        makeAsset({ id: 'b', name: 'b.png' })
      ])
      const { filteredAssets } = useMediaAssetFiltering(assets)

      expect(ids(filteredAssets.value).sort()).toEqual(['a', 'b'])
    })

    it('keeps only assets matching the injected author predicate', () => {
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'mine', name: 'a.png' }),
        makeAsset({ id: 'theirs', name: 'b.png' })
      ])
      const { authorFilter, filteredAssets } = useMediaAssetFiltering(assets, {
        matchesAuthor: (id, author) => author === 'Me' && id === 'mine'
      })

      authorFilter.value = 'Me'
      expect(ids(filteredAssets.value)).toEqual(['mine'])
    })
  })

  describe('date filter', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    function datedAssets() {
      const now = Date.now()
      return ref<AssetItem[]>([
        makeAsset({ id: 'recent', name: 'a.png', createTime: now }),
        makeAsset({
          id: 'stale',
          name: 'b.png',
          createTime: now - 40 * 86_400_000
        })
      ])
    }

    it('returns every asset when no date preset is set', () => {
      const { filteredAssets } = useMediaAssetFiltering(datedAssets())

      expect(ids(filteredAssets.value).sort()).toEqual(['recent', 'stale'])
    })

    it('keeps only assets inside the selected preset window', () => {
      const { dateFilter, filteredAssets } =
        useMediaAssetFiltering(datedAssets())

      dateFilter.value = 'month'
      expect(ids(filteredAssets.value)).toEqual(['recent'])
    })

    it('today cuts off at local midnight', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0))
      const midnight = new Date(2026, 5, 15, 0, 0, 0).getTime()
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'this-morning', name: 'a.png', createTime: midnight }),
        makeAsset({ id: 'yesterday', name: 'b.png', createTime: midnight - 1 })
      ])
      const { dateFilter, filteredAssets } = useMediaAssetFiltering(assets)

      dateFilter.value = 'today'
      expect(ids(filteredAssets.value)).toEqual(['this-morning'])
    })

    it('year cuts off at January 1', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 5, 15))
      const janFirst = new Date(2026, 0, 1).getTime()
      const assets = ref<AssetItem[]>([
        makeAsset({ id: 'this-year', name: 'a.png', createTime: janFirst }),
        makeAsset({ id: 'last-year', name: 'b.png', createTime: janFirst - 1 })
      ])
      const { dateFilter, filteredAssets } = useMediaAssetFiltering(assets)

      dateFilter.value = 'year'
      expect(ids(filteredAssets.value)).toEqual(['this-year'])
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
