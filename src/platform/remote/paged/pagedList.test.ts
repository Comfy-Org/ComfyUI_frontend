import { computed, effectScope, ref, shallowRef, toValue } from 'vue'
import type { Ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { PagedList } from './pagedList'
import { createSharedPagedList } from './pagedList'

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

describe('createSharedPagedList', () => {
  it('same params share reactive state', async () => {
    const useShared = createSharedPagedList(
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
    const useShared = createSharedPagedList(
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
    const useShared = createSharedPagedList(
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
    const useShared = createSharedPagedList(
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
      expect(list2.invalidate).toHaveBeenCalledWith()
      expect(list3.invalidate).not.toHaveBeenCalled()
    })
    scope.stop()
  })
})
