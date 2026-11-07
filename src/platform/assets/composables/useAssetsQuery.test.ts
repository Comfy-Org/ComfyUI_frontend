import { effectScope, toValue, watch } from 'vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { useAssetsQuery } from '@/platform/assets/composables/useAssetsQuery'
import type {
  AssetItem,
  AssetResponse
} from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'

// Ported from the deleted useAssetsQuery.test.ts (fe #16254, 606c2ac30b). Only the
// transient-failure retry coverage is restored here — the rest of that file's
// pagination-dedup assertions no longer match current `doLoadMore`/`loadNew`
// behavior on `main` (no overlap dedup, no updated knownIds mid-walk) and would
// need separate, unrelated fixes to re-add; out of scope for this row.
vi.mock(import('@/scripts/api'))

const fetchApiMock = vi.mocked(api.fetchApi)

function asset(id: string): AssetItem {
  return {
    id,
    name: `${id}.png`,
    loader_path: `${id}.png`,
    tags: ['output'],
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:00:00Z'
  }
}

function response(
  ids: string[],
  {
    hasMore = false,
    nextCursor
  }: { hasMore?: boolean; nextCursor?: string } = {}
): Response {
  const body: AssetResponse = {
    assets: ids.map(asset),
    total: ids.length,
    has_more: hasMore,
    ...(nextCursor === undefined ? {} : { next_cursor: nextCursor })
  }
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function createList(
  key: string,
  initialIds: string[],
  options: { hasMore?: boolean; nextCursor?: string } = {}
) {
  fetchApiMock.mockResolvedValueOnce(response(initialIds, options))
  const scope = effectScope()
  const list = scope.run(() => useAssetsQuery({ name_contains: key }))!
  onTestFinished(() => scope.stop())
  await vi.waitFor(() => expect(toValue(list.isLoading)).toBe(false))
  return list
}

function requestedAfterCursors() {
  return fetchApiMock.mock.calls.slice(1).map(([url]) => {
    const requestUrl = new URL(url, 'http://localhost')
    return requestUrl.searchParams.get('after')
  })
}

const transientFailures: {
  name: string
  fail: () => Promise<Response>
  reason: string
}[] = [
  {
    name: 'HTTP 500',
    fail: () => Promise.resolve(new Response(null, { status: 500 })),
    reason: 'asset request failed'
  },
  {
    name: 'offline request',
    fail: () => Promise.reject(new Error('offline')),
    reason: 'asset fetch failed'
  }
]

describe('useAssetsQuery loadMore transient failure retry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it.for(transientFailures)(
    'retains rows and retries the same cursor after $name',
    async ({ fail, reason }) => {
      const list = await createList(`retry-${reason}`, ['newest'], {
        hasMore: true,
        nextCursor: 'page-2'
      })
      fetchApiMock
        .mockImplementationOnce(fail)
        .mockResolvedValueOnce(response(['older'], { hasMore: false }))

      await list.loadMore()
      await vi.waitFor(() => expect(toValue(list.isLoading)).toBe(false))

      expect(console.error).toHaveBeenCalledWith(reason, expect.anything())
      expect(toValue(list.items).map(({ id }) => id)).toEqual(['newest'])
      expect(toValue(list.hasMore)).toBe(false)
      await vi.advanceTimersByTimeAsync(2000)
      expect(toValue(list.hasMore)).toBe(true)

      await list.loadMore()
      await vi.waitFor(() => expect(toValue(list.isLoading)).toBe(false))

      expect(requestedAfterCursors()).toEqual(['page-2', 'page-2'])
      expect(toValue(list.hasMore)).toBe(false)
      expect(toValue(list.items).map(({ id }) => id)).toEqual([
        'newest',
        'older'
      ])
    }
  )
})

const malformedResponses: {
  name: string
  response: Response
  reason: string
}[] = [
  {
    name: 'malformed JSON',
    response: new Response('{', {
      headers: { 'Content-Type': 'application/json' }
    }),
    reason: 'failed to decode asset json response'
  },
  {
    name: 'an invalid response schema',
    response: new Response(JSON.stringify({ assets: [] }), {
      headers: { 'Content-Type': 'application/json' }
    }),
    reason: 'Failed to parse asset response'
  }
]

describe('useAssetsQuery invalidation during back-off', () => {
  it('waits out the back-off before reloading', async () => {
    vi.useFakeTimers()
    const list = await createList('invalidate-backoff', ['newest'], {
      hasMore: true,
      nextCursor: 'page-2'
    })
    fetchApiMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await list.loadMore()
    fetchApiMock.mockResolvedValueOnce(response(['fresh']))

    const invalidating = list.invalidate()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1000)
    await invalidating
    expect(fetchApiMock).toHaveBeenCalledTimes(3)
    expect(toValue(list.items).map(({ id }) => id)).toEqual(['fresh'])
  })
})

describe('useAssetsQuery malformed response', () => {
  it.for(malformedResponses)(
    'terminates pagination after $name',
    async ({ response, reason }) => {
      const list = await createList(`malformed-${reason}`, ['newest'], {
        hasMore: true,
        nextCursor: 'page-2'
      })
      fetchApiMock.mockResolvedValueOnce(response)

      await expect(list.loadMore()).resolves.toBe(false)

      expect(console.error).toHaveBeenCalledWith(reason, expect.anything())
      expect(toValue(list.items).map(({ id }) => id)).toEqual(['newest'])
      expect(toValue(list.hasMore)).toBe(false)

      await expect(list.loadMore()).resolves.toBe(false)
      expect(requestedAfterCursors()).toEqual(['page-2'])
    }
  )
})

const pageFailures: { name: string; fail: () => Response }[] = [
  { name: 'HTTP 403', fail: () => new Response(null, { status: 403 }) },
  {
    name: 'malformed JSON',
    fail: () =>
      new Response('{', { headers: { 'Content-Type': 'application/json' } })
  },
  {
    name: 'an invalid response schema',
    fail: () => Response.json({ assets: [] })
  }
]

describe('useAssetsQuery recovery after a failed page', () => {
  it.for(pageFailures)(
    'resumes paging after a successful loadNew following $name',
    async ({ name, fail }) => {
      const list = await createList(`recover-${name}`, ['newest'], {
        hasMore: true,
        nextCursor: 'page-2'
      })
      fetchApiMock.mockResolvedValueOnce(fail())
      await expect(list.loadMore()).resolves.toBe(false)
      expect(toValue(list.hasMore)).toBe(false)

      fetchApiMock.mockResolvedValueOnce(response(['newest']))
      await list.loadNew()
      expect(toValue(list.hasMore)).toBe(true)

      fetchApiMock.mockResolvedValueOnce(response(['older']))
      await expect(list.loadMore()).resolves.toBe(true)
      expect(toValue(list.items).map(({ id }) => id)).toEqual([
        'newest',
        'older'
      ])
      expect(requestedAfterCursors()).toEqual(['page-2', null, 'page-2'])
    }
  )

  it('keeps paging stopped after a failed loadNew until one succeeds', async () => {
    const list = await createList('recover-load-new', ['newest'], {
      hasMore: true,
      nextCursor: 'page-2'
    })
    fetchApiMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
    await list.loadNew()
    expect(toValue(list.hasMore)).toBe(false)

    fetchApiMock.mockResolvedValueOnce(response(['newest']))
    await list.loadNew()
    expect(toValue(list.hasMore)).toBe(true)
  })

  it('keeps a fully loaded list stopped after a successful loadNew', async () => {
    const list = await createList('exhausted-load-new', ['newest'])
    fetchApiMock.mockResolvedValueOnce(response(['newest']))
    await list.loadNew()

    expect(toValue(list.hasMore)).toBe(false)
    await expect(list.loadMore()).resolves.toBe(false)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })

  it('keeps a fully loaded list stopped after a transient failure', async () => {
    vi.useFakeTimers()
    const list = await createList('exhausted-transient', ['newest'])
    fetchApiMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await list.loadNew()

    await vi.advanceTimersByTimeAsync(2000)
    expect(toValue(list.hasMore)).toBe(false)
  })

  it('keeps a page failure after a transient failure', async () => {
    vi.useFakeTimers()
    const list = await createList('failed-transient', ['newest'], {
      hasMore: true,
      nextCursor: 'page-2'
    })
    fetchApiMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
    await list.loadMore()
    fetchApiMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await list.loadNew()

    await vi.advanceTimersByTimeAsync(2000)
    expect(toValue(list.hasMore)).toBe(false)
  })

  it.for(pageFailures)(
    'keeps a fully loaded list stopped after $name',
    async ({ name, fail }) => {
      const list = await createList(`exhausted-${name}`, ['newest'])
      fetchApiMock.mockResolvedValueOnce(fail())
      await list.loadNew()
      fetchApiMock.mockResolvedValueOnce(response(['newest']))
      await list.loadNew()

      expect(toValue(list.hasMore)).toBe(false)
    }
  )

  it('clears a page failure on full invalidation', async () => {
    const list = await createList('recover-invalidate', ['newest'], {
      hasMore: true,
      nextCursor: 'page-2'
    })
    fetchApiMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
    await list.loadMore()

    fetchApiMock.mockResolvedValueOnce(
      response(['newest'], { hasMore: true, nextCursor: 'page-2' })
    )
    await list.invalidate()
    expect(toValue(list.hasMore)).toBe(true)
  })
})

describe('useAssetsQuery stale invalidation', () => {
  it('preserves concurrent invalidations across an in-flight page', async () => {
    const list = await createList(
      'stale-in-flight',
      ['deleted-a', 'deleted-b', 'newest'],
      {
        hasMore: true,
        nextCursor: 'page-2'
      }
    )
    let resolvePage!: (response: Response) => void
    fetchApiMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePage = resolve
      })
    )

    const loading = list.loadMore()
    await vi.waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(2))
    const invalidatingA = list.invalidate(['deleted-a'])
    const invalidatingB = list.invalidate(['deleted-b'])
    resolvePage(response(['deleted-a', 'deleted-b', 'older']))
    await Promise.all([loading, invalidatingA, invalidatingB])

    expect(toValue(list.items).map(({ id }) => id)).toEqual(['newest', 'older'])
  })

  it('runs a full invalidation queued behind a stale-item invalidation', async () => {
    const list = await createList('stale-then-full', ['deleted', 'old'])
    fetchApiMock.mockResolvedValueOnce(response(['fresh']))

    await Promise.all([list.invalidate(['deleted']), list.invalidate()])

    expect(toValue(list.items).map(({ id }) => id)).toEqual(['fresh'])
  })
})

describe('useAssetsQuery joined pagination', () => {
  it('reports shared progress to a caller joining a completed page task', async () => {
    const list = await createList('joined-progress', ['newest'], {
      hasMore: true,
      nextCursor: 'page-2'
    })
    fetchApiMock.mockResolvedValueOnce(response(['older']))
    let joinedLoad: Promise<boolean> | undefined
    const stopWatching = watch(
      () => toValue(list.items).length,
      () => {
        queueMicrotask(() => {
          joinedLoad = list.loadMore()
        })
      },
      { flush: 'sync' }
    )
    onTestFinished(stopWatching)

    const firstLoad = list.loadMore()

    await expect(firstLoad).resolves.toBe(true)
    await vi.waitFor(() => expect(joinedLoad).toBeDefined())
    await expect(joinedLoad).resolves.toBe(true)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })
})

describe('useAssetsQuery loadNew pagination', () => {
  it('prepends multiple pages in newest-to-oldest order', async () => {
    const list = await createList('order', ['known'])
    fetchApiMock
      .mockResolvedValueOnce(
        response(['newest', 'newer'], { hasMore: true, nextCursor: 'page-2' })
      )
      .mockResolvedValueOnce(
        response(['new', 'newish', 'known'], { hasMore: false })
      )

    await list.loadNew()

    expect(toValue(list.items).map(({ id }) => id)).toEqual([
      'newest',
      'newer',
      'new',
      'newish',
      'known'
    ])
    expect(requestedAfterCursors()).toEqual([null, 'page-2'])
  })

  it('stops at a known id without inserting duplicates from overlapping pages', async () => {
    const list = await createList('known-id', ['known', 'old'])
    fetchApiMock
      .mockResolvedValueOnce(
        response(['new'], { hasMore: true, nextCursor: 'page-2' })
      )
      .mockResolvedValueOnce(
        response(['new', 'known', 'older-unseen'], {
          hasMore: true,
          nextCursor: 'page-3'
        })
      )
      .mockRejectedValue(new Error('unexpected page after known id'))

    await list.loadNew()

    expect(fetchApiMock).toHaveBeenCalledTimes(3)
    expect(toValue(list.items).map(({ id }) => id)).toEqual([
      'new',
      'known',
      'old'
    ])
    expect(requestedAfterCursors()).toEqual([null, 'page-2'])
  })

  it('rebuilds the list when the head walk finds no cached item within its page cap', async () => {
    const list = await createList('head-cap', ['known'])
    fetchApiMock
      .mockResolvedValueOnce(
        response(['newest'], { hasMore: true, nextCursor: 'A' })
      )
      .mockResolvedValueOnce(
        response(['newer'], { hasMore: true, nextCursor: 'B' })
      )
      .mockResolvedValueOnce(response(['newest', 'newer', 'new']))

    await list.loadNew()

    expect(toValue(list.items).map(({ id }) => id)).toEqual([
      'newest',
      'newer',
      'new'
    ])
    expect(requestedAfterCursors()).toEqual([null, 'A', null])
  })

  it('rebuilds instead of duplicating when every server id changed', async () => {
    const list = await createList('ids-changed', ['old-b', 'old-a'])
    fetchApiMock
      .mockResolvedValueOnce(response(['new-b', 'new-a']))
      .mockResolvedValueOnce(response(['new-b', 'new-a']))

    await list.loadNew()

    expect(toValue(list.items).map(({ id }) => id)).toEqual(['new-b', 'new-a'])
  })

  it('rebuilds once, not again on a later failed walk', async () => {
    const list = await createList('rebuild-once', ['old'])
    fetchApiMock
      .mockResolvedValueOnce(response(['new']))
      .mockResolvedValueOnce(response(['new']))
    await list.loadNew()
    fetchApiMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
    await list.loadNew()

    expect(fetchApiMock).toHaveBeenCalledTimes(4)
    expect(toValue(list.items).map(({ id }) => id)).toEqual(['new'])
  })
})

describe('useAssetsQuery loadMore pagination', () => {
  it('deduplicates overlapping pages and reports successful progress', async () => {
    const list = await createList('load-more', ['newest', 'overlap'], {
      hasMore: true,
      nextCursor: 'page-2'
    })
    fetchApiMock.mockResolvedValueOnce(
      response(['overlap', 'older'], { hasMore: false })
    )

    await expect(list.loadMore()).resolves.toBe(true)

    expect(toValue(list.items).map(({ id }) => id)).toEqual([
      'newest',
      'overlap',
      'older'
    ])
  })

  it('stops pagination when a cursor does not advance', async () => {
    const list = await createList('stuck-load-more', ['newest'], {
      hasMore: true,
      nextCursor: 'stuck'
    })
    fetchApiMock.mockResolvedValueOnce(
      response(['older'], { hasMore: true, nextCursor: 'stuck' })
    )

    await expect(list.loadMore()).resolves.toBe(true)

    expect(toValue(list.hasMore)).toBe(false)
    await expect(list.loadMore()).resolves.toBe(false)
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
  })

  it('stops pagination when cursors cycle across calls', async () => {
    const list = await createList('cycling-load-more', ['newest'], {
      hasMore: true,
      nextCursor: 'A'
    })
    fetchApiMock
      .mockResolvedValueOnce(
        response(['older'], { hasMore: true, nextCursor: 'B' })
      )
      .mockResolvedValueOnce(
        response(['oldest'], { hasMore: true, nextCursor: 'A' })
      )

    await expect(list.loadMore()).resolves.toBe(true)
    await expect(list.loadMore()).resolves.toBe(true)

    expect(toValue(list.hasMore)).toBe(false)
    await expect(list.loadMore()).resolves.toBe(false)
    expect(fetchApiMock).toHaveBeenCalledTimes(3)
  })
})
