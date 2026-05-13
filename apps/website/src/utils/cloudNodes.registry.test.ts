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
  it('requests node ids in batches of 50', async () => {
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
