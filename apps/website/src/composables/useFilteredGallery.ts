import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface FilterableItem {
  filterKey?: string
}

interface UseFilteredGalleryInput<T extends FilterableItem> {
  items: MaybeRefOrGetter<readonly T[]>
  filterKey: MaybeRefOrGetter<string>
  pageSize?: number
}

export const GALLERY_FILTER_ALL = 'all'

export function useFilteredGallery<T extends FilterableItem>(
  input: UseFilteredGalleryInput<T>
) {
  const visibleCount = ref(input.pageSize ?? Infinity)

  const filteredItems = computed<T[]>(() => {
    const allItems = toValue(input.items)
    const key = toValue(input.filterKey)
    if (key === GALLERY_FILTER_ALL) return [...allItems]
    return allItems.filter((item) => item.filterKey === key)
  })

  watch(
    () => toValue(input.filterKey),
    () => {
      visibleCount.value = input.pageSize ?? Infinity
    }
  )

  const visibleItems = computed<T[]>(() =>
    filteredItems.value.slice(0, visibleCount.value)
  )

  const hasMore = computed(
    () => filteredItems.value.length > visibleCount.value
  )

  function showMore(): void {
    if (input.pageSize === undefined) return
    visibleCount.value += input.pageSize
  }

  return { visibleItems, hasMore, showMore }
}
