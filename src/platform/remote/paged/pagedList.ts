import type { MaybeRef } from 'vue'

export type PagedList<T> = {
  hasMore: MaybeRef<boolean>
  invalidate: () => Promise<void>
  isLoading: MaybeRef<boolean>
  items: MaybeRef<T[]>
  loadMore: () => Promise<void>
  loadNew: () => Promise<void>
}

export function wrapPagedList<T>(
  list: PagedList<T>,
  filter: (items: MaybeRef<T[]>) => MaybeRef<T[]>
): PagedList<T> {
  return { ...list, items: filter(list.items) }
}
