import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { MediaAssetDateFilter } from '@comfyorg/assets-core/media'

export const useMediaAssetFilterStore = defineStore('mediaAssetFilter', () => {
  const mediaTypeFilters = ref<string[]>([])
  const dateFilter = ref<MediaAssetDateFilter>('')

  return {
    mediaTypeFilters,
    dateFilter
  }
})
