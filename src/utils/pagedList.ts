import { computed, onScopeDispose, ref, toValue } from 'vue'
import type { MaybeRef } from 'vue'

export interface PagedList<T> {
  hasMore: Readonly<MaybeRef<boolean>>
  invalidate: (items?: string[]) => Promise<void>
  isLoading: Readonly<MaybeRef<boolean>>
  items: Readonly<MaybeRef<T[]>>
  loadMore: () => Promise<void>
  loadNew: () => Promise<void>
}

export class WrappedList<T> implements PagedList<T> {
  readonly items: MaybeRef<T[]>
  constructor(
    private readonly childList: PagedList<T>,
    private readonly transform: (items: readonly T[]) => T[]
  ) {
    this.items = computed(() => this.transform(toValue(this.childList.items)))
  }
  get hasMore() {
    return this.childList.hasMore
  }
  async invalidate() {
    await this.childList.invalidate()
  }
  get isLoading() {
    return this.childList.isLoading
  }
  async loadMore() {
    await this.childList.loadMore()
  }
  async loadNew() {
    await this.childList.loadNew()
  }
}

interface CacheEntry<T> {
  list: PagedList<T>
  refCount: number
}
type Cache<T> = Map<string, CacheEntry<T>>

export interface SharedPagedListState<TParams, TItem> {
  readonly cache: Cache<TItem>
  readonly factory: (params: TParams) => PagedList<TItem>
  readonly paramKeyFn: (params: TParams) => string
  readonly itemKeyFn: (item: TItem) => unknown
}

export function getPagedList<TParams, TItem>(
  params: TParams,
  state: SharedPagedListState<TParams, TItem>
): PagedList<TItem> {
  const key = state.paramKeyFn(params)
  const entry = state.cache.get(key) ?? {
    list: state.factory(params),
    refCount: 0
  }
  state.cache.set(key, entry)
  entry.refCount++

  onScopeDispose(() => --entry.refCount || state.cache.delete(key))
  return new SharedPagedList(entry.list, state.cache, state.itemKeyFn)
}

class SharedPagedList<T> implements PagedList<T> {
  constructor(
    private readonly childList: PagedList<T>,
    private readonly cache: Cache<T>,
    private readonly itemKeyFn: (item: T) => unknown
  ) {}
  overlapping(): PagedList<T>[] {
    const snapshot = toValue(this.childList.items)
    if (snapshot.length === 0) return [this.childList]

    const staleKeys = new Set(snapshot.map(this.itemKeyFn))
    return [...this.cache.values()]
      .filter((e) =>
        toValue(e.list.items).some((item) =>
          staleKeys.has(this.itemKeyFn(item))
        )
      )
      .map((e) => e.list)
  }

  get hasMore() {
    return this.childList.hasMore
  }
  async invalidate(stale?: string[]) {
    const toInvalidate = stale
      ? [...this.cache.values()].map((l) => l.list)
      : this.overlapping()
    await Promise.all(toInvalidate.map((l) => l.invalidate(stale)))
  }
  get isLoading() {
    return this.childList.isLoading
  }
  get items() {
    return this.childList.items
  }
  get loadMore() {
    return this.childList.loadMore
  }
  async loadNew() {
    await Promise.all(this.overlapping().map((l) => l.loadNew()))
  }
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
