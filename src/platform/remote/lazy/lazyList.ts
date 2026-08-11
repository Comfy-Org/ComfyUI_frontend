export type LazyList<T> = {
  canLoadMore: () => boolean
  invalidate: () => Promise<void>
  items: readonly T[]
  loadNew: () => Promise<void>
  onLoadMore: () => Promise<void>
}

export function wrapLazyList<T>(
  list: LazyList<T>,
  filter: (items: readonly T[]) => readonly T[]
): LazyList<T> {
  return { ...list, items: filter(list.items) }
}
