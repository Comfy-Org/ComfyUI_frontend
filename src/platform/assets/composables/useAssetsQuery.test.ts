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
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response
}

async function createList(key: string, initialIds: string[]) {
  fetchApiMock.mockResolvedValueOnce(response(initialIds))
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
