import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { AugmentedResultItem } from '@/utils/resultItem'

export const useMediaGalleryStore = defineStore('mediaGallery', () => {
  const activeIndex = ref(-1)
  const items = shallowRef<AugmentedResultItem[]>([])

  function close() {
    activeIndex.value = -1
  }

  function openItems(
    galleryItems: readonly AugmentedResultItem[],
    selectedItem: AugmentedResultItem
  ) {
    const selectedIndex = galleryItems.indexOf(selectedItem)
    if (selectedIndex === -1) return
    items.value = [...galleryItems]
    activeIndex.value = selectedIndex
  }

  return { activeIndex, items, close, openItems }
})
