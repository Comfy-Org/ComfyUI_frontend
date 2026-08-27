import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toValue } from 'vue'

import { api } from '@/scripts/api'
import { createAssetList } from './createAssetList'

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))

const asset = (id: string) => ({
  id,
  name: `${id}.png`,
  size: 1,
  tags: ['output'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
})

const response = (
  ids: string[],
  options: { hasMore?: boolean; cursor?: string } = {}
) =>
  new Response(
    JSON.stringify({
      assets: ids.map(asset),
      total: ids.length,
      has_more: options.hasMore ?? false,
      next_cursor: options.cursor
    })
  )

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('createAssetList', () => {
  beforeEach(() => {
    vi.mocked(api.fetchApi).mockReset()
  })

  it('coalesces loads and retries the same cursor after failure', async () => {
    const first = deferred<Response>()
    vi.mocked(api.fetchApi)
      .mockReturnValueOnce(first.promise)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response(['b']))
    const list = createAssetList()

    const a = list.loadMore()
    const b = list.loadMore()
    expect(api.fetchApi).toHaveBeenCalledOnce()
    first.resolve(response(['a'], { hasMore: true, cursor: 'next' }))
    await Promise.all([a, b])

    await expect(list.loadMore()).rejects.toThrow('offline')
    await list.loadMore()
    expect(toValue(list.items).map(({ id }) => id)).toEqual(['a', 'b'])
    expect(vi.mocked(api.fetchApi).mock.calls[1][0]).toContain('after=next')
    expect(vi.mocked(api.fetchApi).mock.calls[2][0]).toContain('after=next')
  })

  it('deduplicates IDs and stops on a repeated cursor', async () => {
    vi.mocked(api.fetchApi)
      .mockResolvedValueOnce(response(['a'], { hasMore: true, cursor: 'next' }))
      .mockResolvedValueOnce(
        response(['a', 'b', 'b'], { hasMore: true, cursor: 'next' })
      )
    const list = createAssetList()
    await list.loadMore()
    await list.loadMore()

    expect(toValue(list.items).map(({ id }) => id)).toEqual(['a', 'b'])
    expect(toValue(list.hasMore)).toBe(false)
    await list.loadMore()
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })

  it('aborts and ignores a stale load when refresh preempts it', async () => {
    const stale = deferred<Response>()
    vi.mocked(api.fetchApi)
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(response(['fresh']))
    const list = createAssetList()
    const staleLoad = list.loadMore()
    const queuedHeadLoad = list.loadNew()
    const staleSignal = vi.mocked(api.fetchApi).mock.calls[0][1]?.signal

    await list.invalidate()
    expect(staleSignal?.aborted).toBe(true)
    stale.resolve(response(['stale']))
    await Promise.all([staleLoad, queuedHeadLoad])
    expect(toValue(list.items).map(({ id }) => id)).toEqual(['fresh'])
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
  })

  it('serializes head refreshes behind pagination and deduplicates new items', async () => {
    const page = deferred<Response>()
    vi.mocked(api.fetchApi)
      .mockReturnValueOnce(page.promise)
      .mockResolvedValueOnce(response(['new', 'new', 'old']))
    const list = createAssetList({ tags_any: ['temp', 'output'] })

    const loadPage = list.loadMore()
    const loadNew = list.loadNew()
    expect(api.fetchApi).toHaveBeenCalledOnce()

    page.resolve(response(['old'], { hasMore: true, cursor: 'next' }))
    await Promise.all([loadPage, loadNew])

    expect(api.fetchApi).toHaveBeenCalledTimes(2)
    expect(toValue(list.items).map(({ id }) => id)).toEqual(['new', 'old'])
    expect(vi.mocked(api.fetchApi).mock.calls[0][0]).toBe(
      '/assets?sort=created_at&tags_any=output%2Ctemp&tags_none=missing'
    )
  })
})
