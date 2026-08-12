import type { Ref } from 'vue'

export type PagedList<T> = {
  hasMore: Readonly<Ref<boolean>>
  invalidate: () => Promise<void>
  isLoading: Readonly<Ref<boolean>>
  items: Readonly<Ref<T[]>>
  loadMore: () => Promise<void>
  loadNew: () => Promise<void>
}

export function wrapPagedList<T>(
  list: PagedList<T>,
  filter: (items: Readonly<Ref<T[]>>) => Readonly<Ref<T[]>>
): PagedList<T> {
  return { ...list, items: filter(list.items) }
}
