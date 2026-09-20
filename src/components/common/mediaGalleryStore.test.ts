import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it } from 'vitest'

import type { AugmentedResultItem } from '@/utils/resultItem'

import { useMediaGalleryStore } from './mediaGalleryStore'

const galleryItems = [
  fromPartial<AugmentedResultItem>({ filename: 'a.png', url: '/a.png' }),
  fromPartial<AugmentedResultItem>({ filename: 'b.png', url: '/b.png' })
]

describe('useMediaGalleryStore', () => {
  it('opens the gallery on the selected item', () => {
    const store = useMediaGalleryStore()

    store.openItems(galleryItems, galleryItems[1])

    expect(store.items).toEqual(galleryItems)
    expect(store.activeIndex).toBe(1)
  })

  it('ignores a selection outside the gallery', () => {
    const store = useMediaGalleryStore()

    store.openItems(galleryItems, fromPartial({ filename: 'other.png' }))

    expect(store.items).toEqual([])
    expect(store.activeIndex).toBe(-1)
  })

  it('closes the gallery', () => {
    const store = useMediaGalleryStore()
    store.openItems(galleryItems, galleryItems[0])

    store.close()

    expect(store.activeIndex).toBe(-1)
  })
})
