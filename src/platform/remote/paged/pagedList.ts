import type { MaybeRef } from 'vue'
import { onScopeDispose, toValue } from 'vue'

export type PagedList<T> = {
  hasMore: Readonly<MaybeRef<boolean>>
  invalidate: (items?: Readonly<T[]>) => Promise<void>
  isLoading: Readonly<MaybeRef<boolean>>
  items: Readonly<MaybeRef<T[]>>
  loadMore: () => Promise<void>
  loadNew: () => Promise<void>
}

export function wrapPagedList<T>(
  list: PagedList<T>,
  filter: (items: MaybeRef<readonly T[]>) => MaybeRef<T[]>
): PagedList<T> {
  return { ...list, items: filter(list.items) }
}

interface CacheEntry<T> {
  list: PagedList<T>
  refCount: number
}

export function stableKey(params: Record<string, unknown> = {}): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
  const obj: Record<string, unknown> = {}
  for (const k of keys) {
    const v = params[k]
    obj[k] = Array.isArray(v) ? [...v].sort() : v
  }
  return JSON.stringify(obj)
}

export function createSharedPagedList<TParams, TItem>(
  factory: (params: TParams) => PagedList<TItem>,
  paramKeyFn: (params: TParams) => string,
  itemKeyFn: (item: TItem) => unknown = (item) => item
) {
  const cache = new Map<string, CacheEntry<TItem>>()

  async function invalidateItems(items: Readonly<TItem[]>) {
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

  function constructor(params: TParams): PagedList<TItem> {
    const key = paramKeyFn(params)
    const entry = cache.get(key) ?? { list: factory(params), refCount: 0 }
    cache.set(key, entry)
    entry.refCount++

    onScopeDispose(() => --entry.refCount || cache.delete(key))

    async function invalidate(stale?: Readonly<TItem[]>) {
      if (stale) await invalidateItems(stale)
      else await Promise.all(overlapping(entry).map((e) => e.list.invalidate()))
    }
    async function loadNew() {
      await Promise.all(overlapping(entry).map((e) => e.list.loadNew()))
    }
    return { ...entry.list, invalidate, loadNew }
  }

  return { constructor, invalidateItems }
}
