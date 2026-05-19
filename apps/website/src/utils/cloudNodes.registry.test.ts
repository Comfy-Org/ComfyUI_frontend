import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_REGISTRY_BASE_URL,
  fetchRegistryPacks
} from './cloudNodes.registry'

function jsonResponse(
  body: unknown,
  init: Partial<ResponseInit> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  })
}

describe('fetchRegistryPacks', () => {
  it('requests node ids in batches of 50 with matching limit param', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `pack-${i}`)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const batchIds = url.searchParams.getAll('node_id')
      return jsonResponse({
        nodes: batchIds.map((id) => ({ id, name: id })),
        total: batchIds.length,
        page: 1,
        limit: 50
      })
    })

    const result = await fetchRegistryPacks(ids, {
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(result.size).toBe(120)
    const firstCallUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(firstCallUrl.origin).toBe(DEFAULT_REGISTRY_BASE_URL)
    expect(firstCallUrl.pathname).toBe('/nodes')
    expect(firstCallUrl.searchParams.getAll('node_id')).toHaveLength(50)
    expect(firstCallUrl.searchParams.get('limit')).toBe('50')
    const lastCallUrl = new URL(String(fetchImpl.mock.calls[2]?.[0]))
    expect(lastCallUrl.searchParams.getAll('node_id')).toHaveLength(20)
    expect(lastCallUrl.searchParams.get('limit')).toBe('20')
  })

  it('survives the server defaulting to a small page size (regression for missing limit)', async () => {
    // Mock applies the server's pre-fix behavior: default limit=10 silently
    // truncates batches with more node_id filters than the page size.
    const ids = Array.from({ length: 30 }, (_, i) => `pack-${i}`)
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const requestedLimit = Number(url.searchParams.get('limit') ?? '10')
      const batchIds = url.searchParams
        .getAll('node_id')
        .slice(0, requestedLimit)
      return jsonResponse({
        nodes: batchIds.map((id) => ({ id, name: id })),
        total: batchIds.length,
        page: 1,
        limit: requestedLimit
      })
    })

    const result = await fetchRegistryPacks(ids, {
      fetchImpl: fetchImpl as typeof fetch
    })

    const enriched = [...result.values()].filter((pack) => pack !== null)
    expect(enriched).toHaveLength(30)
  })

  it('accepts null values for optional registry fields and normalizes them to undefined', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        nodes: [
          {
            id: 'pack-with-nulls',
            name: 'Pack With Nulls',
            description: null,
            icon: null,
            banner_url: null,
            supported_os: null,
            supported_accelerators: null,
            publisher: null,
            latest_version: null,
            downloads: 42
          }
        ],
        total: 1,
        page: 1,
        limit: 50
      })
    )

    const result = await fetchRegistryPacks(['pack-with-nulls'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    const pack = result.get('pack-with-nulls')
    expect(pack).not.toBeNull()
    expect(pack?.downloads).toBe(42)
    expect(pack?.description).toBeUndefined()
    expect(pack?.supported_os).toBeUndefined()
    expect(pack?.supported_accelerators).toBeUndefined()
    expect(pack?.publisher).toBeUndefined()
    expect(pack?.latest_version).toBeUndefined()
  })

  it('retries a failed batch once and then succeeds', async () => {
    const fetchImpl = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(
        jsonResponse({
          nodes: [{ id: 'pack-1', name: 'Pack One' }],
          total: 1,
          page: 1,
          limit: 50
        })
      )

    const result = await fetchRegistryPacks(['pack-1'], {
      fetchImpl: fetchImpl as unknown as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.get('pack-1')?.name).toBe('Pack One')
  })

  it('returns an empty map when all batches fail (soft failure)', async () => {
    const ids = ['pack-a', 'pack-b']
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 500 }))

    const result = await fetchRegistryPacks(ids, {
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.size).toBe(0)
  })
})
