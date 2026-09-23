import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { GALLERY_FILTER_ALL, useFilteredGallery } from './useFilteredGallery'

const items = [
  { id: 'a', filterKey: 'livestream' },
  { id: 'b', filterKey: 'hackathon' },
  { id: 'c', filterKey: 'livestream' },
  { id: 'd', filterKey: 'community' },
  { id: 'e', filterKey: 'livestream' }
]

describe('useFilteredGallery', () => {
  it('passes all items through for the "all" filter', () => {
    const { visibleItems } = useFilteredGallery({
      items,
      filterKey: GALLERY_FILTER_ALL
    })
    expect(visibleItems.value.map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e'
    ])
  })

  it('filters items by filterKey', () => {
    const { visibleItems } = useFilteredGallery({
      items,
      filterKey: 'livestream'
    })
    expect(visibleItems.value.map((item) => item.id)).toEqual(['a', 'c', 'e'])
  })

  it('slices to pageSize', () => {
    const { visibleItems, hasMore } = useFilteredGallery({
      items,
      filterKey: GALLERY_FILTER_ALL,
      pageSize: 2
    })
    expect(visibleItems.value.map((item) => item.id)).toEqual(['a', 'b'])
    expect(hasMore.value).toBe(true)
  })

  it('accumulates pages via showMore', () => {
    const { visibleItems, hasMore, showMore } = useFilteredGallery({
      items,
      filterKey: GALLERY_FILTER_ALL,
      pageSize: 2
    })
    showMore()
    expect(visibleItems.value).toHaveLength(4)
    expect(hasMore.value).toBe(true)
    showMore()
    expect(visibleItems.value).toHaveLength(5)
    expect(hasMore.value).toBe(false)
  })

  it('resets the visible count when the filter changes', async () => {
    const filterKey = ref<string>(GALLERY_FILTER_ALL)
    const { visibleItems, showMore } = useFilteredGallery({
      items,
      filterKey,
      pageSize: 2
    })
    showMore()
    expect(visibleItems.value).toHaveLength(4)

    filterKey.value = 'livestream'
    await nextTick()
    expect(visibleItems.value.map((item) => item.id)).toEqual(['a', 'c'])
  })

  it('reports no more items when pageSize covers everything', () => {
    const { hasMore } = useFilteredGallery({
      items,
      filterKey: GALLERY_FILTER_ALL,
      pageSize: 10
    })
    expect(hasMore.value).toBe(false)
  })

  it('shows everything when pageSize is unset', () => {
    const { visibleItems, hasMore } = useFilteredGallery({
      items,
      filterKey: 'livestream'
    })
    expect(visibleItems.value).toHaveLength(3)
    expect(hasMore.value).toBe(false)
  })
})
