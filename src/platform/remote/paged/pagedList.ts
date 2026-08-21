import { computed, onScopeDispose, toValue } from 'vue'
import type { MaybeRef } from 'vue'

export interface PagedList<T> {
  hasMore: Readonly<MaybeRef<boolean>>
  invalidate: (items?: string[]) => Promise<void>
  isLoading: Readonly<MaybeRef<boolean>>
  items: Readonly<MaybeRef<T[]>>
  loadMore: () => Promise<void>
  loadNew: () => Promise<void>
}

export function wrapPagedList<T>(
  list: PagedList<T>,
  filter: (items: MaybeRef<readonly T[]>) => T[]
): PagedList<T> {
  return { ...list, items: computed(() => filter(list.items)) }
}

interface CacheEntry<T> {
  list: PagedList<T>
  refCount: number
}

export function createSharedPagedList<TParams, TItem>(
  factory: (params: TParams) => PagedList<TItem>,
  paramKeyFn: (params: TParams) => string,
  itemKeyFn: (item: TItem) => unknown = (item) => item
) {
  const cache = new Map<string, CacheEntry<TItem>>()

  async function invalidateItems(items: string[]) {
    await Promise.all([...cache.values()].map((e) => e.list.invalidate(items)))
  }

  function overlapping(entry: CacheEntry<TItem>): CacheEntry<TItem>[] {
    const snapshot = toValue(entry.list.items)
    if (snapshot.length === 0) return [entry]

    const staleKeys = new Set(snapshot.map(itemKeyFn))
    return [...cache.values()].filter((e) =>
      toValue(e.list.items).some((item) => staleKeys.has(itemKeyFn(item)))
    )
  }

  return function (params: TParams): PagedList<TItem> {
    const key = paramKeyFn(params)
    const entry = cache.get(key) ?? { list: factory(params), refCount: 0 }
    cache.set(key, entry)
    entry.refCount++

    onScopeDispose(() => --entry.refCount || cache.delete(key))

    async function invalidate(stale?: string[]) {
      if (stale) await invalidateItems(stale)
      else await Promise.all(overlapping(entry).map((e) => e.list.invalidate()))
    }
    async function loadNew() {
      await Promise.all(overlapping(entry).map((e) => e.list.loadNew()))
    }
    return { ...entry.list, invalidate, loadNew }
  }
}
