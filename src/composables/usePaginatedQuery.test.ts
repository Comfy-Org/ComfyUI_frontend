import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope, Ref } from 'vue'

import { usePaginatedQuery } from '@/composables/usePaginatedQuery'
import type { PageResult } from '@/composables/usePaginatedQuery'

type Item = { id: number }

function buildResponse(
  page: number,
  limit: number,
  total: number
): PageResult<Item> {
  const start = (page - 1) * limit
  const items = Array.from(
    { length: Math.max(0, Math.min(limit, total - start)) },
    (_, i) => ({ id: start + i })
  )
  return { items, page, limit, total }
}

describe('usePaginatedQuery', () => {
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

  it('loads page 1 on mount', async () => {
    const fetchPage = vi
      .fn()
      .mockImplementation(({ page, limit }) =>
        Promise.resolve(buildResponse(page, limit, 25))
      )
    const api = runInScope(() =>
      usePaginatedQuery({ key: 'a', initialLimit: 10, fetchPage })
    )
    await nextTick()

    expect(fetchPage).toHaveBeenCalledWith({ key: 'a', page: 1, limit: 10 })
    expect(api.items.value).toHaveLength(10)
    expect(api.total.value).toBe(25)
    expect(api.first.value).toBe(0)
    expect(api.loading.value).toBe(false)
  })

  it('goToPage requests the new page and updates first/page from the response', async () => {
    const fetchPage = vi
      .fn()
      .mockImplementation(({ page, limit }) =>
        Promise.resolve(buildResponse(page, limit, 25))
      )
    const api = runInScope(() =>
      usePaginatedQuery({ key: 'a', initialLimit: 10, fetchPage })
    )
    await nextTick()

    api.goToPage(2)
    await nextTick()
    await vi.waitFor(() => expect(api.page.value).toBe(2))

    expect(fetchPage).toHaveBeenCalledWith({ key: 'a', page: 2, limit: 10 })
    expect(api.first.value).toBe(10)
    expect(api.items.value).toHaveLength(10)
  })

  it('resets to page 1 and refetches when key changes', async () => {
    const fetchPage = vi
      .fn()
      .mockImplementation(({ page, limit }) =>
        Promise.resolve(buildResponse(page, limit, 25))
      )
    const key: Ref<string> = ref('a')
    const api = runInScope(() =>
      usePaginatedQuery({ key, initialLimit: 10, fetchPage })
    )
    await nextTick()

    api.goToPage(2)
    await nextTick()
    await vi.waitFor(() => expect(api.page.value).toBe(2))

    fetchPage.mockClear()
    key.value = 'b'
    await nextTick()

    await vi.waitFor(() =>
      expect(fetchPage).toHaveBeenCalledWith({ key: 'b', page: 1, limit: 10 })
    )
    expect(api.page.value).toBe(1)
  })

  it('discards a superseded response when the key changes mid-fetch', async () => {
    let resolveFirst!: (value: PageResult<Item>) => void
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PageResult<Item>>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(({ page, limit }) =>
        Promise.resolve(buildResponse(page, limit, 5))
      )
    const key = ref('a')
    const api = runInScope(() =>
      usePaginatedQuery({ key, initialLimit: 10, fetchPage })
    )
    await nextTick()

    key.value = 'b'
    await nextTick()
    await vi.waitFor(() => expect(api.total.value).toBe(5))

    resolveFirst(buildResponse(1, 10, 999))
    await nextTick()

    expect(api.total.value).toBe(5)
  })

  it('surfaces a thrown error message and stops loading', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error('boom'))
    const api = runInScope(() =>
      usePaginatedQuery({ key: 'a', initialLimit: 10, fetchPage })
    )
    await nextTick()

    await vi.waitFor(() => expect(api.error.value).toBe('boom'))
    expect(api.loading.value).toBe(false)
  })
})
