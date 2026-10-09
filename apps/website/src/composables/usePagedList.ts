import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

const CATALOGUE_PAGE_SIZE = 12

export function usePagedList<T>(
  items: MaybeRefOrGetter<readonly T[]>,
  pageSize = CATALOGUE_PAGE_SIZE
) {
  const limit = ref(pageSize)

  watch(
    () => toValue(items),
    () => {
      limit.value = pageSize
    }
  )

  const shown = computed(() => toValue(items).slice(0, limit.value))
  const total = computed(() => toValue(items).length)
  const hasMore = computed(() => total.value > limit.value)

  function showMore() {
    limit.value += pageSize
  }

  return { limit, shown, total, hasMore, showMore }
}
