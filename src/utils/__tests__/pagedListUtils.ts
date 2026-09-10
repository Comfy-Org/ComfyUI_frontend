import type { PagedList } from '@/utils/pagedList'

export function mockPagedList<T>(overlay: Partial<PagedList<T>>): PagedList<T> {
  return {
    hasMore: false,
    invalidate: async () => undefined,
    isLoading: false,
    items: [],
    loadMore: async () => false,
    loadNew: async () => undefined,
    ...overlay
  }
}
