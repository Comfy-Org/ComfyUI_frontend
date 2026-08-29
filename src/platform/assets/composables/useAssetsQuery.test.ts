import { effectScope, toValue } from 'vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { useAssetsQuery } from '@/platform/assets/composables/useAssetsQuery'
import type {
  AssetItem,
  AssetResponse
} from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))

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
    const requestUrl = new URL(String(url), 'http://localhost')
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
    name: 'malformed JSON',
    fail: () =>
      Promise.resolve(
        new Response('{', {
          headers: { 'Content-Type': 'application/json' }
        })
      ),
    reason: 'failed to decode asset json response'
  },
  {
    name: 'offline request',
    fail: () => Promise.reject(new Error('offline')),
    reason: 'asset fetch failed'
  }
]

describe('useAssetsQuery loadNew pagination', () => {
  it('prepends multiple pages in newest-to-oldest order', async () => {
    const list = await createList('order', ['known'])
    fetchApiMock
      .mockResolvedValueOnce(
        response(['newest', 'newer'], { hasMore: true, nextCursor: 'page-2' })
      )
      .mockResolvedValueOnce(
        response(['new'], { hasMore: true, nextCursor: 'page-3' })
      )
      .mockResolvedValueOnce(response(['newish'], { hasMore: false }))

    await list.loadNew()

    expect(toValue(list.items).map(({ id }) => id)).toEqual([
      'newest',
      'newer',
      'new',
      'newish',
      'known'
    ])
    expect(requestedAfterCursors()).toEqual([null, 'page-2', 'page-3'])
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

  it('terminates when the cursor does not advance', async () => {
    const list = await createList('stuck-cursor', ['known'])
    fetchApiMock
      .mockResolvedValueOnce(
        response(['newest'], { hasMore: true, nextCursor: 'stuck' })
      )
      .mockResolvedValueOnce(
        response(['newer'], { hasMore: true, nextCursor: 'stuck' })
      )
      .mockRejectedValue(new Error('unexpected extra page'))

    await list.loadNew()

    expect(fetchApiMock).toHaveBeenCalledTimes(3)
    expect(toValue(list.items).map(({ id }) => id)).toEqual([
      'newest',
      'newer',
      'known'
    ])
    expect(requestedAfterCursors()).toEqual([null, 'stuck'])
  })

  it('terminates when cursors cycle', async () => {
    const list = await createList('cycling-cursor', ['known'])
    fetchApiMock
      .mockResolvedValueOnce(
        response(['newest'], { hasMore: true, nextCursor: 'A' })
      )
      .mockResolvedValueOnce(
        response(['newer'], { hasMore: true, nextCursor: 'B' })
      )
      .mockResolvedValueOnce(
        response(['new'], { hasMore: true, nextCursor: 'A' })
      )
      .mockRejectedValue(new Error('unexpected page after cursor cycle'))

    await list.loadNew()

    expect(fetchApiMock).toHaveBeenCalledTimes(4)
    expect(toValue(list.items).map(({ id }) => id)).toEqual([
      'newest',
      'newer',
      'new',
      'known'
    ])
    expect(requestedAfterCursors()).toEqual([null, 'A', 'B'])
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

  it('reports a request failure without consuming pagination state', async () => {
    const list = await createList('failed-load-more', ['newest'], {
      hasMore: true,
      nextCursor: 'page-2'
    })
    fetchApiMock.mockRejectedValueOnce(new Error('network failed'))

    await expect(list.loadMore()).resolves.toBe(false)

    expect(toValue(list.hasMore)).toBe(true)
    expect(toValue(list.items).map(({ id }) => id)).toEqual(['newest'])
  })

  it.for(transientFailures)(
    'retains rows and retries the same cursor after $name',
    async ({ fail, reason }) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const list = await createList(`retry-${reason}`, ['newest'], {
        hasMore: true,
        nextCursor: 'page-2'
      })
      fetchApiMock
        .mockImplementationOnce(fail)
        .mockResolvedValueOnce(response(['older'], { hasMore: false }))

      await expect(list.loadMore()).resolves.toBe(false)

      expect(error).toHaveBeenCalledWith(reason, expect.anything())
      expect(toValue(list.hasMore)).toBe(true)
      expect(toValue(list.items).map(({ id }) => id)).toEqual(['newest'])

      await expect(list.loadMore()).resolves.toBe(true)

      expect(requestedAfterCursors()).toEqual(['page-2', 'page-2'])
      expect(toValue(list.hasMore)).toBe(false)
      expect(toValue(list.items).map(({ id }) => id)).toEqual([
        'newest',
        'older'
      ])
    }
  )
})
