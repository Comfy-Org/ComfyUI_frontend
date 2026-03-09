import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { AssetItem } from '../schemas/assetSchema'

export const useMediaAssetGalleryStore = defineStore(
  'mediaAssetGallery',
  () => {
    const activeIndex = ref(-1)
    const items = shallowRef<AssetItem[]>([])

    const close = () => {
      activeIndex.value = -1
    }

    const openSingle = (asset: AssetItem) => {
      items.value = [asset]
      activeIndex.value = 0
    }

    return {
      activeIndex,
      items,
      close,
      openSingle
    }
  }
)
