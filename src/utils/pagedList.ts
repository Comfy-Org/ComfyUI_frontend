import { computed, onScopeDispose, ref, toValue } from 'vue'
import type { MaybeRef } from 'vue'

export interface PagedList<T> {
  hasMore: Readonly<MaybeRef<boolean>>
  invalidate: (items?: string[]) => Promise<void>
  isLoading: Readonly<MaybeRef<boolean>>
  items: Readonly<MaybeRef<T[]>>
  loadMore: () => Promise<void>
  /** False when the source could not advance. */
  loadMoreWithProgress?: () => Promise<boolean>
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

  function constructor(params: TParams): PagedList<TItem> {
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
  async function invalidateAll() {
    await Promise.all([...cache.values()].map((e) => e.list.invalidate()))
  }
  return { constructor, invalidateAll }
}

type Runner = (signal: AbortSignal) => Promise<void>
const PREEMPT_KIND: unique symbol = Symbol()
type Kind = string | typeof PREEMPT_KIND
interface Task {
  kind: Kind
  promise: Promise<void>
  resolve: () => void
  start: () => void
}

export function usePreemptableQueue() {
  const queue: Task[] = []
  const running = ref(false)
  let controller = new AbortController()

  function makeTask(kind: Kind, runner: Runner): Task {
    let resolve!: () => void
    const promise = new Promise<void>((r) => (resolve = r))

    const start = () =>
      runner(controller.signal)
        .catch(() => undefined)
        .then(resolve)
    return { kind, promise, resolve, start }
  }

  function enqueue(kind: Kind, runner: Runner): Promise<void> {
    if (queue[0]?.kind === PREEMPT_KIND) return queue[0].promise

    const existing = queue.find((task) => task.kind === kind)
    if (existing) return existing.promise

    const task = makeTask(kind, runner)
    queue.push(task)
    if (queue.length === 1) void startQueue()
    return task.promise
  }

  async function preempt(runner: () => Promise<void>): Promise<void> {
    if (queue[0]?.kind === PREEMPT_KIND) return queue[0].promise

    const task = makeTask(PREEMPT_KIND, runner)
    controller.abort()
    controller = new AbortController()
    const active = queue[0]
    const existing = queue.splice(0, queue.length, task)
    if (active) {
      await active.promise
      queue.push(task)
      for (const task of existing) task.resolve()
    } else {
      void startQueue()
    }
    await task.promise
  }

  async function startQueue() {
    running.value = true
    while (queue.length) {
      await queue[0].start()
      queue.shift()
    }
    running.value = false
  }

  return { enqueue, preempt, running }
}
