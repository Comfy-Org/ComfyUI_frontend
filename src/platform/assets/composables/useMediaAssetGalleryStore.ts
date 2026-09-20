import { clamp } from 'es-toolkit'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { AugmentedResultItem } from '@/utils/resultItem'

import type { AssetMeta } from '../schemas/mediaAssetSchema'

export const useMediaAssetGalleryStore = defineStore(
  'mediaAssetGallery',
  () => {
    const activeIndex = ref(-1)
    const items = shallowRef<AugmentedResultItem[]>([])

    const close = () => {
      activeIndex.value = -1
    }

    const openSingle = (asset: AssetMeta) => {
      items.value = [
        {
          filename: asset.name,
          subfolder: '',
          type: 'output',
          nodeId: '0',
          mediaType: asset.kind === 'image' ? 'images' : asset.kind,
          url: asset.src || ''
        }
      ]
      activeIndex.value = 0
    }

    const openItems = (
      galleryItems: readonly AugmentedResultItem[],
      index: number
    ) => {
      if (!galleryItems.length) return
      items.value = [...galleryItems]
      activeIndex.value = clamp(index, 0, galleryItems.length - 1)
    }

    return {
      activeIndex,
      items,
      close,
      openSingle,
      openItems
    }
  }
)
