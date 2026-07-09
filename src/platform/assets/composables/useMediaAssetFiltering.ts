import { refDebounced } from '@vueuse/core'
import { sortBy as sortByUtil } from 'es-toolkit'
import Fuse from 'fuse.js'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

type SortOption = 'newest' | 'oldest' | 'longest' | 'fastest' | 'az' | 'za'

/**
 * Get timestamp from asset (either create_time or created_at)
 */
const getAssetTime = (asset: AssetItem): number => {
  return (
    (asset.user_metadata?.create_time as number) ??
    (asset.created_at ? new Date(asset.created_at).getTime() : 0)
  )
}

/**
 * Get execution time from asset user_metadata
 */
const getAssetExecutionTime = (asset: AssetItem): number => {
  return (asset.user_metadata?.executionTimeInSeconds as number) ?? 0
}

/** Case-insensitive display name used for alphabetical sorting. */
const getAssetSortName = (asset: AssetItem): string => {
  return (asset.display_name || asset.name || '').toLowerCase()
}

/** Inclusive lower bound (ms) for a date preset. */
const datePresetStart = (preset: string): number => {
  const now = Date.now()
  const start = new Date(now)
  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      return start.getTime()
    case 'week':
      return now - 7 * 86_400_000
    case 'month':
      return now - 30 * 86_400_000
    case 'year':
      return new Date(start.getFullYear(), 0, 1).getTime()
    default:
      return 0
  }
}

/**
 * Media Asset Filtering composable
 * Manages search, filter, and sort for media assets
 */
export function useMediaAssetFiltering(assets: Ref<AssetItem[]>) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)
  const sortBy = ref<SortOption>('newest')
  const mediaTypeFilters = ref<string[]>([])
  const dateFilter = ref('')

  const fuseOptions = {
    keys: ['display_name', 'name'],
    threshold: 0.4,
    includeScore: true
  }

  const fuse = computed(() => new Fuse(assets.value, fuseOptions))

  const searchFiltered = computed(() => {
    if (!debouncedSearchQuery.value.trim()) {
      return assets.value
    }

    const results = fuse.value.search(debouncedSearchQuery.value)
    return results.map((result) => result.item)
  })

  const typeFiltered = computed(() => {
    // Apply media type filter
    if (mediaTypeFilters.value.length === 0) {
      return searchFiltered.value
    }

    return searchFiltered.value.filter((asset) => {
      const mediaType = getMediaTypeFromFilename(asset.name)
      // Convert '3D' to '3d' for comparison
      const normalizedType = mediaType.toLowerCase()
      return mediaTypeFilters.value.includes(normalizedType)
    })
  })

  const dateFiltered = computed(() => {
    if (!dateFilter.value) {
      return typeFiltered.value
    }
    const start = datePresetStart(dateFilter.value)
    return typeFiltered.value.filter((asset) => getAssetTime(asset) >= start)
  })

  const filteredAssets = computed(() => {
    // Sort by create_time (output assets) or created_at (input assets)
    switch (sortBy.value) {
      case 'oldest':
        // Ascending order (oldest first)
        return sortByUtil(dateFiltered.value, [getAssetTime])
      case 'longest':
        // Descending order (longest execution time first)
        return sortByUtil(dateFiltered.value, [
          (asset) => -getAssetExecutionTime(asset)
        ])
      case 'fastest':
        // Ascending order (fastest execution time first)
        return sortByUtil(dateFiltered.value, [getAssetExecutionTime])
      case 'az':
        return [...dateFiltered.value].sort((a, b) =>
          getAssetSortName(a).localeCompare(getAssetSortName(b))
        )
      case 'za':
        return [...dateFiltered.value].sort((a, b) =>
          getAssetSortName(b).localeCompare(getAssetSortName(a))
        )
      case 'newest':
      default:
        // Descending order (newest first) - negate for descending
        return sortByUtil(dateFiltered.value, [(asset) => -getAssetTime(asset)])
    }
  })

  return {
    searchQuery,
    sortBy,
    mediaTypeFilters,
    dateFilter,
    filteredAssets
  }
}
