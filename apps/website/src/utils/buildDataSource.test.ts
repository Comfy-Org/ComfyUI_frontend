import { describe, expect, it, vi } from 'vitest'

import { createBuildDataSource } from './buildDataSource'

interface TestOptions {
  cacheKey?: string
  snapshot?: string
}

describe('createBuildDataSource', () => {
  it('returns fresh data without reading the snapshot', async () => {
    const readSnapshot = vi.fn(async () => 'snapshot')
    const source = createBuildDataSource<TestOptions, string>({
      name: 'test',
      fetchFresh: async () => ({
        kind: 'ok',
        snapshot: 'fresh',
        data: {}
      }),
      getDefaultOptions: () => ({}),
      readSnapshot
    })

    await expect(source.fetchForBuild()).resolves.toEqual({
      status: 'fresh',
      snapshot: 'fresh'
    })
    expect(readSnapshot).not.toHaveBeenCalled()
  })

  it('falls back to a snapshot when the fresh fetch fails', async () => {
    const source = createBuildDataSource<TestOptions, string>({
      name: 'test',
      fetchFresh: async () => ({ kind: 'err', reason: 'HTTP 500' }),
      getDefaultOptions: () => ({}),
      readSnapshot: async (options) => options.snapshot ?? null
    })

    await expect(
      source.fetchForBuild({ snapshot: 'last-known-good' })
    ).resolves.toEqual({
      status: 'stale',
      snapshot: 'last-known-good',
      reason: 'HTTP 500'
    })
  })

  it('returns failed when fresh data and a snapshot are unavailable', async () => {
    const source = createBuildDataSource<TestOptions, string>({
      name: 'test',
      fetchFresh: async () => ({ kind: 'err', reason: 'HTTP 500' }),
      getDefaultOptions: () => ({}),
      readSnapshot: async () => null
    })

    await expect(source.fetchForBuild()).resolves.toEqual({
      status: 'failed',
      reason: 'HTTP 500'
    })
  })

  it('memoizes matching cache keys and rejects mismatched keys', async () => {
    const fetchFresh = vi.fn(async () => ({
      kind: 'ok' as const,
      snapshot: 'fresh',
      data: {}
    }))
    const source = createBuildDataSource<TestOptions, string>({
      name: 'test',
      fetchFresh,
      getDefaultOptions: () => ({}),
      readSnapshot: async () => null,
      getCacheKey: (options) => options.cacheKey ?? 'default'
    })

    const first = source.fetchForBuild({ cacheKey: 'a' })
    const second = source.fetchForBuild({ cacheKey: 'a' })

    expect(first).toBe(second)
    await expect(first).resolves.toEqual({
      status: 'fresh',
      snapshot: 'fresh'
    })
    expect(fetchFresh).toHaveBeenCalledTimes(1)
    expect(() => source.fetchForBuild({ cacheKey: 'b' })).toThrow(
      /called twice with different options/
    )
  })
})
