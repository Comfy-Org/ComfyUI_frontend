import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { MediaAssetDateFilter } from '@/platform/assets/mediaAssetFilterOptions'

export const useMediaAssetFilterStore = defineStore('mediaAssetFilter', () => {
  const mediaTypeFilters = ref<string[]>([])
  const dateFilter = ref<MediaAssetDateFilter>('')

  return {
    mediaTypeFilters,
    dateFilter
  }
})
