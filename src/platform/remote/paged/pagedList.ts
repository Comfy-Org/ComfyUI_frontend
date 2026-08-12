import type { MaybeRef } from 'vue'
import { onScopeDispose } from 'vue'

export type PagedList<T> = {
  hasMore: MaybeRef<boolean>
  invalidate: (items?: T[]) => Promise<void>
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
  keyFn: (params: TParams) => string
): (params: TParams) => PagedList<TItem> {
  const cache = new Map<string, CacheEntry<TItem>>()

  return (params: TParams): PagedList<TItem> => {
    const key = keyFn(params)
    const entry = cache.get(key) ?? { list: factory(params), refCount: 0 }
    cache.set(key, entry)
    entry.refCount++

    onScopeDispose(() => {
      entry.refCount--
      if (entry.refCount === 0) cache.delete(key)
    })

    async function invalidate(stale?: TItem[]) {
      if (!stale) return await entry.list.invalidate()

      await Promise.all(
        [...cache.values()].map((e) => e.list.invalidate(stale))
      )
    }
    return { ...entry.list, invalidate }
  }
}
