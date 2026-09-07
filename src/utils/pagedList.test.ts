import { describe, expect, it, vi } from 'vitest'
import { computed, effectScope, ref, shallowRef, toValue } from 'vue'
import type { Ref } from 'vue'

import type { PagedList, SharedPagedListState } from './pagedList'
import { getPagedList, usePreemptableQueue, WrappedList } from './pagedList'

function mockPagedList<T>(initial: T[] = [], genNew?: () => T): PagedList<T> {
  const items: Ref<T[]> = shallowRef(initial)
  return {
    hasMore: ref(false),
    invalidate: vi.fn(async () => {}),
    isLoading: ref(false),
    items,
    loadMore: vi.fn(async () => {
      if (genNew) items.value = [...items.value, genNew()]
    }),
    loadNew: vi.fn(async () => {})
  }
}

function makeShared<TParams, TItem>(
  factory: (params: TParams) => PagedList<TItem>,
  paramKeyFn: (params: TParams) => string,
  itemKeyFn: (item: TItem) => unknown = (item) => item
) {
  const state: SharedPagedListState<TParams, TItem> = {
    cache: new Map(),
    factory,
    paramKeyFn,
    itemKeyFn
  }
  return (params: TParams) => getPagedList(params, state)
}

describe('WrappedList', () => {
  it('transforms items and delegates stateful operations', async () => {
    const child = {
      isLoading: ref(false),
      items: ref([1, 2]),
      get hasMore() {
        return this.items.value.length < 3
      },
      async invalidate(stale?: string[]) {
        this.items.value = this.items.value.filter(
          (item) => !stale?.includes(String(item))
        )
      },
      async loadMore() {
        this.items.value.push(3)
      },
      async loadNew() {
        this.items.value.unshift(0)
      }
    }

    const list = new WrappedList(child, (items) =>
      items.map((item) => item * 2)
    )

    expect(toValue(list.items)).toEqual([2, 4])
    expect(toValue(list.hasMore)).toBe(true)
    expect(toValue(list.isLoading)).toBe(false)

    await list.loadMore()
    expect(toValue(list.items)).toEqual([2, 4, 6])
    expect(toValue(list.hasMore)).toBe(false)

    await list.loadNew()
    expect(toValue(list.items)).toEqual([0, 2, 4, 6])

    await list.invalidate(['2'])
    expect(toValue(list.items)).toEqual([0, 2, 6])
  })
})

describe('getPagedList', () => {
  it('same params share reactive state', async () => {
    const useShared = makeShared(
      () => mockPagedList<string>([], () => 'test'),
      (p: string) => p
    )
    const scope = effectScope()
    await scope.run(async () => {
      const a = useShared('key')
      const b = useShared('key')
      const derived = computed(() => toValue(b.items).length)
      expect(derived.value).toBe(0)
      await a.loadMore()
      expect(toValue(a.items)).toHaveLength(1)
      expect(derived.value).toBe(1)
    })
    scope.stop()
  })

  it('cache entry survives partial dispose and cleans up when all scopes end', () => {
    let createCount = 0
    const useShared = makeShared(
      () => {
        createCount++
        return mockPagedList()
      },
      (p: string) => p
    )
    const scope1 = effectScope()
    const scope2 = effectScope()

    let items1!: PagedList<unknown>['items']
    scope1.run(() => {
      items1 = useShared('key').items
    })
    scope2.run(() => {
      useShared('key')
    })
    expect(createCount).toBe(1)

    scope1.stop()
    const scope3 = effectScope()
    scope3.run(() => {
      expect(useShared('key').items).toBe(items1)
    })
    expect(createCount).toBe(1)

    scope2.stop()
    scope3.stop()

    const scope4 = effectScope()
    scope4.run(() => {
      expect(useShared('key').items).not.toBe(items1)
    })
    expect(createCount).toBe(2)
    scope4.stop()
  })

  it('invalidate(items) propagates across all cached lists', async () => {
    const list1 = mockPagedList<{ id: string }>()
    const list2 = mockPagedList<{ id: string }>()
    let callCount = 0
    const useShared = makeShared(
      () => {
        callCount++
        return callCount === 1 ? list1 : list2
      },
      (p: string) => p,
      (item) => item.id
    )
    const scope = effectScope()
    const stale = ['x']
    await scope.run(async () => {
      const a = useShared('outputs')
      useShared('inputs')
      await a.invalidate(stale)
      expect(list1.invalidate).toHaveBeenCalledWith(stale)
      expect(list2.invalidate).toHaveBeenCalledWith(stale)
    })
    scope.stop()
  })

  it('full invalidation propagates to overlapping siblings but not disjoint ones', async () => {
    const list1 = mockPagedList<{ id: string }>([{ id: 'shared' }, { id: 'a' }])
    const list2 = mockPagedList<{ id: string }>([{ id: 'shared' }, { id: 'b' }])
    const list3 = mockPagedList<{ id: string }>([{ id: 'c' }])
    let callCount = 0
    const useShared = makeShared(
      () => {
        callCount++
        return [list1, list2, list3][callCount - 1]
      },
      (p: string) => p,
      (item) => item.id
    )
    const scope = effectScope()
    await scope.run(async () => {
      const outputs = useShared('outputs')
      useShared('outputs,temp')
      useShared('inputs')
      await outputs.invalidate()
      expect(list2.invalidate).toHaveBeenCalledWith(undefined)
      expect(list3.invalidate).not.toHaveBeenCalled()
    })
    scope.stop()
  })
})

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const noop = async () => {}

describe('usePreemptableQueue', () => {
  it('coalesces concurrent same-kind enqueue calls', async () => {
    const { enqueue } = usePreemptableQueue()
    const gate = deferred()
    const runner = vi.fn(async () => {
      await gate.promise
    })

    const a = enqueue('more', runner)
    const b = enqueue('more', runner)
    const c = enqueue('more', runner)

    expect(runner).toHaveBeenCalledTimes(1)
    gate.resolve()
    await Promise.all([a, b, c])
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('serializes different kinds: second waits for the first to finish', async () => {
    const { enqueue } = usePreemptableQueue()
    const moreGate = deferred()
    const order: string[] = []

    const morePromise = enqueue('more', async () => {
      order.push('more:start')
      await moreGate.promise
      order.push('more:end')
    })
    const newPromise = enqueue('new', async () => {
      order.push('new:start')
      order.push('new:end')
    })

    expect(order).toEqual(['more:start'])
    moreGate.resolve()
    await Promise.all([morePromise, newPromise])
    expect(order).toEqual(['more:start', 'more:end', 'new:start', 'new:end'])
  })

  it('preempt aborts the running task', async () => {
    const { enqueue, preempt } = usePreemptableQueue()
    const started = deferred()
    let observedSignal: AbortSignal | null = null

    const morePromise = enqueue('more', async (signal) => {
      observedSignal = signal
      started.resolve()
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve())
      )
    })

    await started.promise
    const preemptPromise = preempt(async () => {})

    await Promise.all([morePromise, preemptPromise])
    expect(observedSignal!.aborted).toBe(true)
  })

  it('enqueue during in-flight preempt returns the preempt promise', async () => {
    const { enqueue, preempt } = usePreemptableQueue()
    const gate = deferred()
    const preemptRunner = vi.fn(async () => {
      await gate.promise
    })
    const other = vi.fn(noop)

    const preemptPromise = preempt(preemptRunner)
    const morePromise = enqueue('more', other)
    const newPromise = enqueue('new', other)

    expect(other).not.toHaveBeenCalled()
    gate.resolve()
    await Promise.all([preemptPromise, morePromise, newPromise])
    expect(other).not.toHaveBeenCalled()
    expect(preemptRunner).toHaveBeenCalledTimes(1)
  })

  it('coalesces concurrent preempt calls', async () => {
    const { preempt } = usePreemptableQueue()
    const gate = deferred()
    const runner = vi.fn(async () => {
      await gate.promise
    })

    const a = preempt(runner)
    const b = preempt(runner)
    const c = preempt(runner)

    expect(runner).toHaveBeenCalledTimes(1)
    gate.resolve()
    await Promise.all([a, b, c])
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('preempt displaces a queued task and redirects its promise', async () => {
    const { enqueue, preempt } = usePreemptableQueue()
    const moreGate = deferred()
    const preemptRunner = vi.fn(noop)
    const other = vi.fn(noop)

    const morePromise = enqueue('more', async () => {
      await moreGate.promise
    })
    const newPromise = enqueue('new', other)
    const preemptPromise = preempt(preemptRunner)

    moreGate.resolve()
    await Promise.all([morePromise, newPromise, preemptPromise])
    expect(other).not.toHaveBeenCalled()
    expect(preemptRunner).toHaveBeenCalledTimes(1)
  })

  it('running is true while any task is active', async () => {
    const { enqueue, running } = usePreemptableQueue()
    const gate = deferred()

    expect(running.value).toBe(false)
    const done = enqueue('more', async () => {
      await gate.promise
    })
    expect(running.value).toBe(true)
    gate.resolve()
    await done
    await vi.waitFor(() => expect(running.value).toBe(false))
  })

  it('promotes a queued task after the current completes', async () => {
    const { enqueue } = usePreemptableQueue()
    const moreGate = deferred()
    const news = vi.fn(noop)

    const morePromise = enqueue('more', async () => {
      await moreGate.promise
    })
    const newPromise = enqueue('new', news)

    expect(news).not.toHaveBeenCalled()
    moreGate.resolve()
    await Promise.all([morePromise, newPromise])
    expect(news).toHaveBeenCalledTimes(1)
  })
})
