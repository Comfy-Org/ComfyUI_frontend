import { refDebounced } from '@vueuse/core'
import Fuse from 'fuse.js'
import { storeToRefs } from 'pinia'
import { computed, toValue, ref } from 'vue'
import type { MaybeRef } from 'vue'

import { useMediaAssetFilterStore } from '@/platform/assets/composables/useMediaAssetFilterStore'
import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

/**
 * Get timestamp from asset (either create_time or created_at)
 */
const getAssetTime = (asset: AssetItem): number => {
  const createTime = asset.user_metadata?.create_time
  return typeof createTime === 'number'
    ? createTime
    : asset.created_at
      ? new Date(asset.created_at).getTime()
      : 0
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

/**
 * Media Asset Filtering composable
 * Manages search and filters for media assets
 */
export function useMediaAssetFiltering(assets: MaybeRef<readonly AssetItem[]>) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)
  const { mediaTypeFilters, dateFilter } = storeToRefs(
    useMediaAssetFilterStore()
  )

  const fuseOptions = {
    keys: ['display_name', 'name'],
    threshold: 0.4,
    includeScore: true
  }

  const fuse = computed(() => new Fuse(toValue(assets), fuseOptions))

  const searchFiltered = computed(() => {
    if (!debouncedSearchQuery.value.trim()) {
      return toValue(assets)
    }

    const results = fuse.value.search(debouncedSearchQuery.value)
    return results.map((result) => result.item)
  })

  const filteredAssets = computed(() => {
    const threshold = getDateThreshold(dateFilter.value)
    return searchFiltered.value.filter((asset) => {
      const matchesMediaType =
        mediaTypeFilters.value.length === 0 ||
        mediaTypeFilters.value.includes(
          getMediaTypeFromFilename(asset.name).toLowerCase()
        )
      const matchesDate = threshold === null || getAssetTime(asset) >= threshold

      return matchesMediaType && matchesDate
    })
  })

  return {
    searchQuery,
    mediaTypeFilters,
    dateFilter,
    filteredAssets
  }
}
