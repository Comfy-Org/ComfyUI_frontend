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
  keyFn: (params: TParams) => string,
  itemKey: (item: TItem) => unknown = (item) => item
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

    async function invalidate(stale?: Readonly<TItem[]>) {
      if (stale) {
        await Promise.all(
          [...cache.values()].map((e) => e.list.invalidate(stale))
        )
        return
      }

      const snapshot = toValue(entry.list.items)
      await entry.list.invalidate()
      if (snapshot.length === 0) return

      const staleKeys = new Set(snapshot.map(itemKey))
      await Promise.all(
        [...cache.values()]
          .filter(
            (e) =>
              e !== entry &&
              toValue(e.list.items).some((item) => staleKeys.has(itemKey(item)))
          )
          .map((e) => e.list.invalidate())
      )
    }
    return { ...entry.list, invalidate }
  }
}
