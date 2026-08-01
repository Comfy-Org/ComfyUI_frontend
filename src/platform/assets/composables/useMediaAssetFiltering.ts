import { refDebounced } from '@vueuse/core'
import { sortBy as sortByUtil } from 'es-toolkit'
import Fuse from 'fuse.js'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import { useMediaAssetFilterStore } from '@/platform/assets/composables/useMediaAssetFilterStore'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetDisplayName } from '@/platform/assets/utils/assetMetadataUtils'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'longest' | 'fastest'

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

function getDateThreshold(filter: MediaAssetDateFilter): number | null {
  const now = Date.now()

  switch (filter) {
    case 'today': {
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      return startOfToday.getTime()
    }
    case 'week':
      return now - 7 * 86_400_000
    case 'month':
      return now - 30 * 86_400_000
    case 'year':
      return new Date(new Date(now).getFullYear(), 0, 1).getTime()
    default:
      return null
  }
}

const compareAssetNames = (a: AssetItem, b: AssetItem): number =>
  getAssetDisplayName(a).localeCompare(getAssetDisplayName(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  })

/**
 * Media Asset Filtering composable
 * Manages search, filter, and sort for media assets
 */
export function useMediaAssetFiltering(assets: Ref<AssetItem[]>) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)
  const sortBy = ref<SortOption>('newest')
  const { mediaTypeFilters, dateFilter } = storeToRefs(
    useMediaAssetFilterStore()
  )

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

  const filteredAssets = computed(() => {
    const threshold = getDateThreshold(dateFilter.value)
    const filtered = searchFiltered.value.filter((asset) => {
      const matchesMediaType =
        mediaTypeFilters.value.length === 0 ||
        mediaTypeFilters.value.includes(
          getMediaTypeFromFilename(asset.name).toLowerCase()
        )
      const matchesDate = threshold === null || getAssetTime(asset) >= threshold

      return matchesMediaType && matchesDate
    })

    // Sort by create_time (output assets) or created_at (input assets)
    switch (sortBy.value) {
      case 'oldest':
        // Ascending order (oldest first)
        return sortByUtil(filtered, [getAssetTime])
      case 'longest':
        // Descending order (longest execution time first)
        return sortByUtil(filtered, [(asset) => -getAssetExecutionTime(asset)])
      case 'fastest':
        // Ascending order (fastest execution time first)
        return sortByUtil(filtered, [getAssetExecutionTime])
      case 'az':
        return [...filtered].sort(compareAssetNames)
      case 'za':
        return [...filtered].sort((a, b) => compareAssetNames(b, a))
      case 'newest':
      default:
        // Descending order (newest first) - negate for descending
        return sortByUtil(filtered, [(asset) => -getAssetTime(asset)])
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
