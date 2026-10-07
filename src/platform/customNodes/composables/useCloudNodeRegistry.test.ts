import type { CloudNodeRegistry } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { useCloudNodeRegistry } from './useCloudNodeRegistry'

vi.mock('@/scripts/api', () => ({ api: { fetchApi: vi.fn() } }))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
const fetchApi = vi.mocked(api.fetchApi)

const fixture = (pinned = false, prepared = true): CloudNodeRegistry => ({
  corpus_commit: 'a'.repeat(40),
  pins: pinned ? ['b'.repeat(64)] : [],
  revisions: [
    {
      revision_id: 'b'.repeat(64),
      name: 'Example',
      pack_id: 'example/x1234567',
      upstream_commit: 'c'.repeat(40),
      source_sha256: 'd'.repeat(64),
      manifest_sha256: 'e'.repeat(64),
      dependency_profile_sha256: 'f'.repeat(64),
      nodes: ['ExampleNode'],
      node_api_version: 2,
      comfy_verified: false,
      pinned,
      prepared
    }
  ]
})

describe('useCloudNodeRegistry', () => {
  beforeEach(() => fetchApi.mockReset())

  it('loads the Cloud V2 catalog with validated generated types', async () => {
    fetchApi.mockResolvedValueOnce(Response.json(fixture()))
    const registry = useCloudNodeRegistry()
    await registry.load()
    expect(fetchApi).toHaveBeenCalledWith('/customnodes/registry', {
      method: 'GET'
    })
    expect(registry.state.value.phase).toBe('ready')
    expect(registry.catalog.value).toEqual(fixture())
  })

  it('pins only an exact revision without an installation queue or owner override', async () => {
    fetchApi
      .mockResolvedValueOnce(Response.json(fixture()))
      .mockResolvedValueOnce(Response.json(fixture(true)))
    const registry = useCloudNodeRegistry()
    await registry.load()
    await registry.setPin('b'.repeat(64), true)
    expect(fetchApi.mock.calls[1]).toEqual([
      '/customnodes/registry/pins',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: 'b'.repeat(64), pinned: true })
      }
    ])
    expect(fetchApi).toHaveBeenCalledTimes(2)
    expect(registry.catalog.value?.revisions[0].pinned).toBe(true)
  })

  it('keeps pinned and prepared as distinct states', async () => {
    fetchApi
      .mockResolvedValueOnce(Response.json(fixture(false, false)))
      .mockResolvedValueOnce(Response.json(fixture(true, false)))
    const registry = useCloudNodeRegistry()
    await registry.load()
    await registry.setPin('b'.repeat(64), true)
    expect(registry.catalog.value?.revisions[0]).toMatchObject({
      pinned: true,
      prepared: false
    })
  })

  it('does not optimistically claim a rejected pin', async () => {
    fetchApi
      .mockResolvedValueOnce(Response.json(fixture()))
      .mockResolvedValueOnce(
        Response.json({ error: 'conflicting node' }, { status: 409 })
      )
    const registry = useCloudNodeRegistry()
    await registry.load()
    expect(await registry.setPin('b'.repeat(64), true)).toBe(false)
    expect(registry.state.value.phase).toBe('error')
    expect(registry.catalog.value?.revisions[0].pinned).toBe(false)
    expect(registry.busy.value).toBe(false)
  })

  it('rejects invalid catalog data without falling back to install APIs', async () => {
    fetchApi.mockResolvedValueOnce(Response.json({ revisions: [] }))
    const registry = useCloudNodeRegistry()
    expect(await registry.load()).toBe(false)
    expect(registry.catalog.value).toBeNull()
    expect(registry.state.value.phase).toBe('error')
    expect(fetchApi).toHaveBeenCalledOnce()
  })

  it('refuses V1 and unknown-version pin requests without calling a conversion or install API', async () => {
    const catalog = fixture()
    catalog.revisions[0] = { ...catalog.revisions[0], node_api_version: 1 }
    fetchApi.mockResolvedValueOnce(Response.json(catalog))
    const registry = useCloudNodeRegistry()
    await registry.load()
    expect(await registry.setPin('b'.repeat(64), true)).toBe(false)
    expect(fetchApi).toHaveBeenCalledOnce()
    expect(registry.state.value.phase).toBe('ready')
    fetchApi.mockResolvedValueOnce(
      Response.json({
        ...catalog,
        revisions: [{ ...catalog.revisions[0], node_api_version: undefined }]
      })
    )
    await registry.load()
    expect(await registry.setPin('b'.repeat(64), true)).toBe(false)
    expect(fetchApi).toHaveBeenCalledTimes(2)
  })

  it('rejects a verified claim with no revision-bound execution receipt', async () => {
    const catalog = fixture()
    catalog.revisions[0] = { ...catalog.revisions[0], comfy_verified: true }
    fetchApi.mockResolvedValueOnce(Response.json(catalog))
    const registry = useCloudNodeRegistry()
    expect(await registry.load()).toBe(false)
    expect(registry.catalog.value).toBeNull()
  })

  it('keeps the old catalog and blocks further pins after an uncertain mutation', async () => {
    fetchApi
      .mockResolvedValueOnce(Response.json(fixture()))
      .mockRejectedValueOnce(new TypeError('Disconnected'))
    const registry = useCloudNodeRegistry()
    await registry.load()
    expect(await registry.setPin('b'.repeat(64), true)).toBe(false)
    expect(await registry.setPin('b'.repeat(64), true)).toBe(false)
    expect(fetchApi).toHaveBeenCalledTimes(2)
    expect(registry.catalog.value?.revisions[0].pinned).toBe(false)
  })
})
