import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, shallowRef, toValue, watch } from 'vue'

export interface PageResult<T> {
  items: T[]
  page: number
  limit: number
  total: number
}

export class PageRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PageRequestError'
  }
}

interface UsePaginatedQueryOptions<T, K> {
  /**
   * Reactive identity of the query. Changing it resets to page 1 and
   * refetches — use it for anything that selects a different backend or
   * dataset (a billing rail, a filter, a search term).
   */
  key: MaybeRefOrGetter<K>
  initialLimit?: number
  /**
   * Fetches one page. Throw `PageRequestError` with a message meant for
   * display; the query surfaces it verbatim as `error`.
   */
  fetchPage: (params: {
    key: K
    page: number
    limit: number
  }) => Promise<PageResult<T>>
}

/**
 * Owns server-side pagination for one query: the requested page/limit, the
 * last response, and a request-token guard so a superseded fetch (a `key`
 * change while a page load is in flight) can never overwrite a later one.
 *
 * `page`, `limit`, `total` and `first` are all derived from the last
 * response rather than tracked as separate assignable state, so there is
 * one source of truth for "where the query is" instead of several fields a
 * caller must remember to keep in sync.
 */
export function usePaginatedQuery<T, K>(
  options: UsePaginatedQueryOptions<T, K>
) {
  const { key, initialLimit = 10, fetchPage } = options

  const lastResponse = shallowRef<PageResult<T> | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const items = computed(() => lastResponse.value?.items ?? [])
  const page = computed(() => lastResponse.value?.page ?? 1)
  const limit = computed(() => lastResponse.value?.limit ?? initialLimit)
  const total = computed(() => lastResponse.value?.total ?? 0)
  const first = computed(() => (page.value - 1) * limit.value)

  let requestToken = 0

  const load = async (requestedPage: number) => {
    const token = ++requestToken
    loading.value = true
    error.value = null

    try {
      const response = await fetchPage({
        key: toValue(key),
        page: requestedPage,
        limit: limit.value
      })
      if (token !== requestToken) return
      lastResponse.value = response
    } catch (err) {
      if (token !== requestToken) return
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (token === requestToken) loading.value = false
    }
  }

  const goToPage = (requestedPage: number) => void load(requestedPage)
  const refresh = () => load(1)

  watch(
    () => toValue(key),
    () => void load(1),
    { immediate: true }
  )

  return {
    items,
    page,
    limit,
    total,
    first,
    loading,
    error,
    goToPage,
    refresh
  }
}
