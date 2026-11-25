import { refDebounced } from '@vueuse/core'
import Fuse from 'fuse.js'
import { storeToRefs } from 'pinia'
import { computed, ref, toValue } from 'vue'
import type { MaybeRef } from 'vue'

import { filterMediaAssets, sortMediaAssets } from '@comfyorg/assets-core/media'
import type { MediaAssetSortOption } from '@comfyorg/assets-core/media'
import type { AssetItem } from '@comfyorg/assets-core/schema'

import { useMediaAssetFilterStore } from '@/platform/assets/stores/useMediaAssetFilterStore'

export function useMediaAssetFiltering(assets: MaybeRef<readonly AssetItem[]>) {
  const searchQuery = ref('')
  const debouncedSearchQuery = refDebounced(searchQuery, 50)
  const sortBy = ref<MediaAssetSortOption>('newest')
  const { mediaTypeFilters, dateFilter } = storeToRefs(
    useMediaAssetFilterStore()
  )
  const fuse = computed(
    () =>
      new Fuse(toValue(assets), {
        keys: ['display_name', 'name'],
        threshold: 0.4,
        includeScore: true
      })
  )
  const searchFiltered = computed(() =>
    debouncedSearchQuery.value.trim()
      ? fuse.value
          .search(debouncedSearchQuery.value)
          .map((result) => result.item)
      : toValue(assets)
  )
  const filteredAssets = computed(() =>
    sortMediaAssets(
      filterMediaAssets(
        searchFiltered.value,
        mediaTypeFilters.value,
        dateFilter.value,
        Date.now()
      ),
      sortBy.value
    )
  )

  return { searchQuery, sortBy, mediaTypeFilters, dateFilter, filteredAssets }
}
