import type { Ref } from 'vue'

export type LazyList<T> = {
  hasMore: Readonly<Ref<boolean>>
  invalidate: () => Promise<void>
  isLoading: Readonly<Ref<boolean>>
  items: Readonly<Ref<T[]>>
  loadMore: () => Promise<void>
  loadNew: () => Promise<void>
}

export function wrapLazyList<T>(
  list: LazyList<T>,
  filter: (items: Readonly<Ref<T[]>>) => Readonly<Ref<T[]>>
): LazyList<T> {
  return { ...list, items: filter(list.items) }
}
