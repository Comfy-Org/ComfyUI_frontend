import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_REGISTRY_BASE_URL,
  fetchRegistryPacks,
  fetchRegistryPacksWithNodes
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

describe('fetchRegistryPacksWithNodes', () => {
  it('fetches pack metadata and comfy nodes for each pack', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      // Pack metadata request
      if (url.pathname === '/nodes') {
        return jsonResponse({
          nodes: [
            {
              id: 'comfyui-impact-pack',
              name: 'ComfyUI Impact Pack',
              repository: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack',
              latest_version: { version: '8.0.0', createdAt: '2026-01-01' }
            }
          ]
        })
      }

      // Comfy nodes request
      if (url.pathname.includes('/comfy-nodes')) {
        return jsonResponse({
          comfy_nodes: [
            { comfy_node_name: 'FaceDetailer', category: 'detailer' },
            { comfy_node_name: 'DetailerForEach', category: 'detailer' }
          ],
          totalNumberOfPages: 1
        })
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(['comfyui-impact-pack'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(result.size).toBe(1)
    const packData = result.get('comfyui-impact-pack')
    expect(packData).not.toBeNull()
    expect(packData?.pack.name).toBe('ComfyUI Impact Pack')
    expect(packData?.nodes).toHaveLength(2)
    expect(packData?.nodes[0]?.comfy_node_name).toBe('FaceDetailer')
  })

  it('handles pagination for comfy nodes', async () => {
    let comfyNodesCallCount = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname === '/nodes') {
        return jsonResponse({
          nodes: [
            {
              id: 'big-pack',
              name: 'Big Pack',
              latest_version: { version: '1.0.0' }
            }
          ]
        })
      }

      if (url.pathname.includes('/comfy-nodes')) {
        comfyNodesCallCount++
        const page = Number(url.searchParams.get('page') ?? '1')

        if (page === 1) {
          return jsonResponse({
            comfy_nodes: [
              { comfy_node_name: 'Node1', category: 'cat1' },
              { comfy_node_name: 'Node2', category: 'cat1' }
            ],
            totalNumberOfPages: 2
          })
        } else {
          return jsonResponse({
            comfy_nodes: [{ comfy_node_name: 'Node3', category: 'cat2' }],
            totalNumberOfPages: 2
          })
        }
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(['big-pack'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(comfyNodesCallCount).toBe(2)
    const packData = result.get('big-pack')
    expect(packData?.nodes).toHaveLength(3)
  })

  it('returns null for packs without latest_version', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname === '/nodes') {
        return jsonResponse({
          nodes: [
            {
              id: 'no-version-pack',
              name: 'No Version Pack',
              latest_version: null
            }
          ]
        })
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(['no-version-pack'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(result.get('no-version-pack')).toBeNull()
  })

  it('returns empty nodes array when comfy-nodes request fails', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname === '/nodes') {
        return jsonResponse({
          nodes: [
            {
              id: 'failing-pack',
              name: 'Failing Pack',
              latest_version: { version: '1.0.0' }
            }
          ]
        })
      }

      if (url.pathname.includes('/comfy-nodes')) {
        return new Response('Server error', { status: 500 })
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(['failing-pack'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    const packData = result.get('failing-pack')
    expect(packData).not.toBeNull()
    expect(packData?.pack.name).toBe('Failing Pack')
    expect(packData?.nodes).toHaveLength(0)
  })

  it('handles null comfy_nodes in response', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname === '/nodes') {
        return jsonResponse({
          nodes: [
            {
              id: 'null-nodes-pack',
              name: 'Null Nodes Pack',
              latest_version: { version: '1.0.0' }
            }
          ]
        })
      }

      if (url.pathname.includes('/comfy-nodes')) {
        return jsonResponse({
          comfy_nodes: null,
          totalNumberOfPages: 1
        })
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(['null-nodes-pack'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    const packData = result.get('null-nodes-pack')
    expect(packData?.nodes).toHaveLength(0)
  })

  it('fetches nodes for multiple packs in parallel', async () => {
    const packIds = ['pack-a', 'pack-b', 'pack-c']
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname === '/nodes') {
        const requestedIds = url.searchParams.getAll('node_id')
        return jsonResponse({
          nodes: requestedIds.map((id) => ({
            id,
            name: id.toUpperCase(),
            latest_version: { version: '1.0.0' }
          }))
        })
      }

      if (url.pathname.includes('/comfy-nodes')) {
        const packId = url.pathname.split('/nodes/')[1]?.split('/')[0]
        return jsonResponse({
          comfy_nodes: [
            { comfy_node_name: `${packId}-node`, category: 'test' }
          ],
          totalNumberOfPages: 1
        })
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(packIds, {
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(result.size).toBe(3)
    for (const packId of packIds) {
      const packData = result.get(packId)
      expect(packData).not.toBeNull()
      expect(packData?.nodes[0]?.comfy_node_name).toBe(`${packId}-node`)
    }
  })

  it('retries comfy-nodes fetch once on failure', async () => {
    let comfyNodesAttempts = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname === '/nodes') {
        return jsonResponse({
          nodes: [
            {
              id: 'retry-pack',
              name: 'Retry Pack',
              latest_version: { version: '1.0.0' }
            }
          ]
        })
      }

      if (url.pathname.includes('/comfy-nodes')) {
        comfyNodesAttempts++
        if (comfyNodesAttempts === 1) {
          return new Response('Server error', { status: 500 })
        }
        return jsonResponse({
          comfy_nodes: [{ comfy_node_name: 'RetryNode', category: 'test' }],
          totalNumberOfPages: 1
        })
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(['retry-pack'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(comfyNodesAttempts).toBe(2)
    const packData = result.get('retry-pack')
    expect(packData?.nodes).toHaveLength(1)
    expect(packData?.nodes[0]?.comfy_node_name).toBe('RetryNode')
  })

  it('normalizes null boolean fields in comfy nodes', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))

      if (url.pathname === '/nodes') {
        return jsonResponse({
          nodes: [
            {
              id: 'bool-pack',
              name: 'Bool Pack',
              latest_version: { version: '1.0.0' }
            }
          ]
        })
      }

      if (url.pathname.includes('/comfy-nodes')) {
        return jsonResponse({
          comfy_nodes: [
            {
              comfy_node_name: 'TestNode',
              category: 'test',
              deprecated: null,
              experimental: null
            }
          ],
          totalNumberOfPages: 1
        })
      }

      return new Response('Not found', { status: 404 })
    })

    const result = await fetchRegistryPacksWithNodes(['bool-pack'], {
      fetchImpl: fetchImpl as typeof fetch
    })

    const packData = result.get('bool-pack')
    expect(packData?.nodes[0]?.deprecated).toBeUndefined()
    expect(packData?.nodes[0]?.experimental).toBeUndefined()
  })
})
