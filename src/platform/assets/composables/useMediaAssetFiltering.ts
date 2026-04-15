import { refDebounced } from '@vueuse/core'
import { sortBy as sortByUtil } from 'es-toolkit'
import Fuse from 'fuse.js'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetUserProperties } from '@/platform/assets/schemas/userPropertySchema'
import { getAssetAdditionalTags } from '@/platform/assets/utils/assetMetadataUtils'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

type SortOption = 'newest' | 'oldest' | 'longest' | 'fastest'

// --- Property filter parsing and evaluation ---

export interface PropertyFilter {
  key: string
  op: string
  target: string
}

export function parsePropFilter(chip: string): PropertyFilter | null {
  const body = chip.startsWith('prop:') ? chip.slice(5) : chip
  const match = body.match(/^(\w+)(>=|<=|>|<|=|~)(.+)$/)
  if (!match) return null
  return { key: match[1], op: match[2], target: match[3] }
}

function matchesPropertyFilter(
  value: unknown,
  op: string,
  target: string
): boolean {
  if (typeof value === 'number') {
    const n = Number(target)
    if (isNaN(n)) return false
    switch (op) {
      case '=':
        return value === n
      case '>':
        return value > n
      case '<':
        return value < n
      case '>=':
        return value >= n
      case '<=':
        return value <= n
    }
  }
  if (typeof value === 'boolean') return value === (target === 'true')
  if (typeof value === 'string') {
    if (op === '~') return value.toLowerCase().includes(target.toLowerCase())
    return value === target
  }
  return false
}

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

/**
 * Media Asset Filtering composable
 * Manages search, filter, and sort for media assets
 */
export function useMediaAssetFiltering(assets: Ref<AssetItem[]>) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)
  const sortBy = ref<SortOption>('newest')
  const mediaTypeFilters = ref<string[]>([])
  const filterTags = ref<string[]>([])
  const propertyFilters = ref<PropertyFilter[]>([])

  const fuseOptions = {
    keys: ['display_name', 'name', 'user_metadata.additional_tags'],
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

  const tagFiltered = computed(() => {
    if (filterTags.value.length === 0) return searchFiltered.value
    return searchFiltered.value.filter((asset) => {
      const assetTags = getAssetAdditionalTags(asset)
      return filterTags.value.every((t) => assetTags.includes(t))
    })
  })

  const typeFiltered = computed(() => {
    // Apply media type filter
    if (mediaTypeFilters.value.length === 0) {
      return tagFiltered.value
    }

    return tagFiltered.value.filter((asset) => {
      const mediaType = getMediaTypeFromFilename(asset.name)
      // Convert '3D' to '3d' for comparison
      const normalizedType = mediaType.toLowerCase()
      return mediaTypeFilters.value.includes(normalizedType)
    })
  })

  const propertyFiltered = computed(() => {
    if (propertyFilters.value.length === 0) return typeFiltered.value
    return typeFiltered.value.filter((asset) => {
      const props = getAssetUserProperties(asset.user_metadata)
      return propertyFilters.value.every(({ key, op, target }) => {
        const prop = props[key]
        if (!prop) return false
        return matchesPropertyFilter(prop.value, op, target)
      })
    })
  })

  const filteredAssets = computed(() => {
    switch (sortBy.value) {
      case 'oldest':
        return sortByUtil(propertyFiltered.value, [getAssetTime])
      case 'longest':
        return sortByUtil(propertyFiltered.value, [
          (asset) => -getAssetExecutionTime(asset)
        ])
      case 'fastest':
        return sortByUtil(propertyFiltered.value, [getAssetExecutionTime])
      case 'newest':
      default:
        return sortByUtil(propertyFiltered.value, [
          (asset) => -getAssetTime(asset)
        ])
    }
  })

  return {
    searchQuery,
    filterTags,
    propertyFilters,
    sortBy,
    mediaTypeFilters,
    filteredAssets
  }
}
