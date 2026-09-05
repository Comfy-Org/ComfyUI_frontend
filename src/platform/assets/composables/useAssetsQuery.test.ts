import { effectScope, toValue } from 'vue'
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
    const requestUrl = new URL(url, 'http://localhost')
    return requestUrl.searchParams.get('after')
  })
}

// `useAssetsQuery`'s internal `backingOff` ref (src/platform/assets/composables/
// useAssetsQuery.ts) auto-resets after 2000ms via `refAutoReset`. It is only armed
// for the "no response object" (network reject) and 5xx/429 branches of `doQuery`,
// not for a successfully-received-but-malformed body. Each case below advances
// fake timers past that window before asserting `hasMore` recovers, matching real
// backoff timing instead of assuming an immediate reset (the original PR's shared
// assertion that `hasMore` stays `true` right after failure only actually holds for
// the malformed-JSON case).
const transientFailures: {
  name: string
  fail: () => Promise<Response>
  reason: string
  backsOff: boolean
}[] = [
  {
    name: 'HTTP 500',
    fail: () => Promise.resolve(new Response(null, { status: 500 })),
    reason: 'asset request failed',
    backsOff: true
  },
  {
    name: 'malformed JSON',
    fail: () =>
      Promise.resolve(
        new Response('{', {
          headers: { 'Content-Type': 'application/json' }
        })
      ),
    reason: 'failed to decode asset json response',
    backsOff: false
  },
  {
    name: 'offline request',
    fail: () => Promise.reject(new Error('offline')),
    reason: 'asset fetch failed',
    backsOff: true
  }
]

describe('useAssetsQuery loadMore transient failure retry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it.for(transientFailures)(
    'retains rows and retries the same cursor after $name',
    async ({ fail, reason, backsOff }) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const list = await createList(`retry-${reason}`, ['newest'], {
        hasMore: true,
        nextCursor: 'page-2'
      })
      fetchApiMock
        .mockImplementationOnce(fail)
        .mockResolvedValueOnce(response(['older'], { hasMore: false }))

      await list.loadMore()
      await vi.waitFor(() => expect(toValue(list.isLoading)).toBe(false))

      expect(error).toHaveBeenCalledWith(reason, expect.anything())
      expect(toValue(list.items).map(({ id }) => id)).toEqual(['newest'])
      if (backsOff) {
        // 5xx / network-reject branches arm the 2s backoff, which gates
        // hasMore off until it auto-resets.
        expect(toValue(list.hasMore)).toBe(false)
        await vi.advanceTimersByTimeAsync(2000)
      }
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
