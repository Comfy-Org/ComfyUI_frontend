import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'

import { useLazyPagination } from '@/composables/useLazyPagination'

type Item = { id: number }

const buildItems = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: i }))

describe('useLazyPagination', () => {
  let scope: EffectScope | undefined

  const runInScope = <T>(fn: () => T): T => {
    scope = effectScope()
    const result = scope.run(fn)
    if (result === undefined) {
      throw new Error('composable returned nothing')
    }
    return result
  }

  beforeEach(() => {
    scope = undefined
  })

  afterEach(() => {
    scope?.stop()
  })

  it('loads the first page immediately when items are present', async () => {
    const items = ref(buildItems(40))
    const api = runInScope(() => useLazyPagination(items, { itemsPerPage: 12 }))

    await nextTick()

    expect(api.currentPage.value).toBe(1)
    expect(api.paginatedItems.value).toHaveLength(12)
    expect(api.totalPages.value).toBe(Math.ceil(40 / 12))
    expect(api.hasMoreItems.value).toBe(true)
    expect(api.isLoading.value).toBe(false)
  })

  it('advances pages and resolves with isLoading reset', async () => {
    const items = ref(buildItems(30))
    const api = runInScope(() => useLazyPagination(items, { itemsPerPage: 10 }))
    await nextTick()

    await api.loadNextPage()

    expect(api.isLoading.value).toBe(false)
    expect(api.currentPage.value).toBe(2)
    expect(api.paginatedItems.value).toHaveLength(20)
  })

  it('stops loading once every page has been exposed', async () => {
    const items = ref(buildItems(20))
    const api = runInScope(() => useLazyPagination(items, { itemsPerPage: 10 }))
    await nextTick()

    await api.loadNextPage()
    expect(api.hasMoreItems.value).toBe(false)

    await api.loadNextPage()
    expect(api.currentPage.value).toBe(2)
    expect(api.paginatedItems.value).toHaveLength(20)
  })

  it('treats a plain array input identically to a ref input', async () => {
    const api = runInScope(() =>
      useLazyPagination(buildItems(8), { itemsPerPage: 5 })
    )
    await nextTick()

    expect(api.totalPages.value).toBe(2)
    expect(api.paginatedItems.value).toHaveLength(5)

    await api.loadNextPage()
    expect(api.paginatedItems.value).toHaveLength(8)
  })

  it('ignores non-array inputs rather than throwing', async () => {
    const weird: unknown = { not: 'an-array' }
    const api = runInScope(() =>
      useLazyPagination(weird as Item[], { itemsPerPage: 5 })
    )
    await nextTick()

    expect(api.paginatedItems.value).toEqual([])
    expect(api.totalPages.value).toBe(0)
    expect(api.hasMoreItems.value).toBe(false)
  })

  it('starts loading the first page once the source fills in', async () => {
    const items = ref<Item[]>([])
    const api = runInScope(() => useLazyPagination(items, { itemsPerPage: 4 }))
    await nextTick()

    expect(api.paginatedItems.value).toEqual([])

    items.value = buildItems(6)
    await nextTick()

    expect(api.paginatedItems.value).toHaveLength(4)
    expect(api.hasMoreItems.value).toBe(true)
  })

  it('reset reloads the first page when items exist', async () => {
    const items = ref(buildItems(20))
    const api = runInScope(() => useLazyPagination(items, { itemsPerPage: 5 }))
    await nextTick()

    await api.loadNextPage()
    await api.loadNextPage()
    expect(api.paginatedItems.value).toHaveLength(15)

    api.reset()
    await nextTick()

    expect(api.currentPage.value).toBe(1)
    expect(api.paginatedItems.value).toHaveLength(5)
    expect(api.isLoading.value).toBe(false)
  })

  it('reset with no items leaves nothing loaded', async () => {
    const items = ref<Item[]>([])
    const api = runInScope(() => useLazyPagination(items, { itemsPerPage: 5 }))
    await nextTick()

    api.reset()
    await nextTick()

    expect(api.paginatedItems.value).toEqual([])
    expect(api.totalPages.value).toBe(0)
  })

  it('does not advance beyond the last page even with extra calls', async () => {
    const items = ref(buildItems(15))
    const api = runInScope(() => useLazyPagination(items, { itemsPerPage: 10 }))
    await nextTick()

    await api.loadNextPage()
    await api.loadNextPage()
    await api.loadNextPage()

    expect(api.currentPage.value).toBe(2)
    expect(api.paginatedItems.value).toHaveLength(15)
    expect(api.hasMoreItems.value).toBe(false)
  })

  it('honors a custom initialPage on reset', async () => {
    const items = ref(buildItems(30))
    const api = runInScope(() =>
      useLazyPagination(items, { itemsPerPage: 10, initialPage: 3 })
    )
    await nextTick()
    await api.loadNextPage()

    api.reset()
    await nextTick()

    expect(api.currentPage.value).toBe(3)
    expect(api.paginatedItems.value).toHaveLength(10)
  })
})
