import { refDebounced } from '@vueuse/core'
import Fuse from 'fuse.js'
import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/**
 * Media Asset Filtering composable
 * Manages search, filter, and sort for media assets
 */
export function useMediaAssetFiltering(assets: Ref<AssetItem[]>) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)

  const fuseOptions = {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true
  }

  const fuse = computed(() => new Fuse(assets.value, fuseOptions))

  const filteredAssets = computed(() => {
    if (!debouncedSearchQuery.value.trim()) {
      return assets.value
    }

    const results = fuse.value.search(debouncedSearchQuery.value)
    return results.map((result) => result.item)
  })

  return {
    searchQuery,
    filteredAssets
  }
}
