import type { CloudNodeRegistry } from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

import { useCloudNodeRegistry } from './useCloudNodeRegistry'

vi.mock('@/scripts/api', () => ({ api: { fetchApi: vi.fn() } }))
vi.mock('@/scripts/app', () => ({ app: { reloadNodeDefs: vi.fn() } }))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
const workspace = vi.hoisted(() => ({
  activeWorkspaceId: 'workspace-a',
  workspaceTransitionGeneration: 0
}))
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => workspace
}))
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
  beforeEach(() => {
    fetchApi.mockReset()
    vi.mocked(app.reloadNodeDefs).mockReset().mockResolvedValue()
    workspace.activeWorkspaceId = 'workspace-a'
    workspace.workspaceTransitionGeneration = 0
  })

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
    expect(app.reloadNodeDefs).toHaveBeenCalledTimes(2)
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

  it('pins a private account-owned revision without inventing an upstream Git commit', async () => {
    const catalog = fixture()
    catalog.revisions[0] = {
      ...catalog.revisions[0],
      upstream_commit: '',
      account_owned: true
    }
    fetchApi
      .mockResolvedValueOnce(Response.json(catalog))
      .mockResolvedValueOnce(
        Response.json({
          ...catalog,
          revisions: [{ ...catalog.revisions[0], pinned: true }]
        })
      )
    const registry = useCloudNodeRegistry()
    await registry.load()
    expect(await registry.setPin('b'.repeat(64), true)).toBe(true)
    expect(fetchApi).toHaveBeenCalledTimes(2)
  })

  it('refreshes definitions on unpin and retains the persisted pin if refresh fails', async () => {
    fetchApi
      .mockResolvedValueOnce(Response.json(fixture(true)))
      .mockResolvedValueOnce(Response.json(fixture(false)))
    const registry = useCloudNodeRegistry()
    await registry.load()
    vi.mocked(app.reloadNodeDefs).mockRejectedValueOnce(
      new Error('Unavailable')
    )
    expect(await registry.setPin('b'.repeat(64), false)).toBe(false)
    expect(registry.catalog.value?.revisions[0].pinned).toBe(false)
    expect(registry.state.value.phase).toBe('error')
    expect(app.reloadNodeDefs).toHaveBeenCalledTimes(2)
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

  it('auto-pins a loaded graph using authenticated exact palette requests and one final definition refresh', async () => {
    fetchApi
      .mockResolvedValueOnce(Response.json(fixture(false, false)))
      .mockResolvedValueOnce(Response.json(fixture(true, false)))
    const registry = useCloudNodeRegistry()
    expect(
      await registry.autoPinGraphPacks(
        {
          nodes: [
            { id: 1, type: 'ExampleNode' },
            { id: 2, type: 'ExampleNode' }
          ]
        },
        {
          ExampleNode: {
            python_module: 'custom_nodes.cloud_registry.' + 'b'.repeat(64),
            comfy_cloud_palette_visible: false
          }
        }
      )
    ).toBe(true)
    expect(fetchApi.mock.calls[1]).toEqual([
      '/customnodes/registry/pins',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: 'b'.repeat(64), pinned: true })
      })
    ])
    expect(app.reloadNodeDefs).toHaveBeenCalledOnce()
    expect(registry.catalog.value?.revisions[0]).toMatchObject({
      pinned: true,
      prepared: false
    })
  })

  it('does not issue repeat pin mutations on graph reload or contact the registry for core-only graphs', async () => {
    fetchApi.mockResolvedValueOnce(Response.json(fixture(true)))
    const registry = useCloudNodeRegistry()
    expect(
      await registry.autoPinGraphPacks(
        { nodes: [{ id: 1, type: 'ExampleNode' }] },
        {
          ExampleNode: {
            python_module: 'custom_nodes.cloud_registry.' + 'b'.repeat(64),
            comfy_cloud_palette_visible: true
          }
        }
      )
    ).toBe(true)
    expect(fetchApi).toHaveBeenCalledOnce()
    expect(app.reloadNodeDefs).not.toHaveBeenCalled()
    expect(
      await registry.autoPinGraphPacks(
        { nodes: [{ id: 1, type: 'KSampler' }] },
        { KSampler: { python_module: 'nodes' } }
      )
    ).toBe(true)
    expect(fetchApi).toHaveBeenCalledOnce()
  })

  it('returns a recoverable failure without claiming a refused auto-pin succeeded', async () => {
    fetchApi
      .mockResolvedValueOnce(Response.json(fixture()))
      .mockResolvedValueOnce(
        Response.json({ error: 'conflict' }, { status: 409 })
      )
    const registry = useCloudNodeRegistry()
    expect(
      await registry.autoPinGraphPacks(
        { nodes: [{ id: 1, type: 'ExampleNode' }] },
        {}
      )
    ).toBe(false)
    expect(registry.catalog.value?.revisions[0].pinned).toBe(false)
    expect(app.reloadNodeDefs).not.toHaveBeenCalled()
  })

  it('batches several graph packs while retaining unrelated pins', async () => {
    const original = fixture()
    const first = {
      ...original.revisions[0],
      nodes: ['SecondNode'],
      revision_id: '1'.repeat(64)
    }
    const other = {
      ...original.revisions[0],
      nodes: ['OtherNode'],
      revision_id: '2'.repeat(64),
      pinned: true
    }
    const catalog = {
      ...original,
      pins: [other.revision_id],
      revisions: [...original.revisions, first, other]
    }
    const afterFirst = {
      ...catalog,
      pins: [...catalog.pins, 'b'.repeat(64)],
      revisions: catalog.revisions.map((revision) => ({
        ...revision,
        pinned: revision.pinned || revision.revision_id === 'b'.repeat(64)
      }))
    }
    const afterSecond = {
      ...afterFirst,
      pins: [...afterFirst.pins, first.revision_id],
      revisions: afterFirst.revisions.map((revision) => ({
        ...revision,
        pinned: true
      }))
    }
    fetchApi
      .mockResolvedValueOnce(Response.json(catalog))
      .mockResolvedValueOnce(Response.json(afterFirst))
      .mockResolvedValueOnce(Response.json(afterSecond))
    const registry = useCloudNodeRegistry()
    expect(
      await registry.autoPinGraphPacks(
        {
          nodes: [
            { id: 1, type: 'ExampleNode' },
            { id: 2, type: 'SecondNode' }
          ]
        },
        {}
      )
    ).toBe(true)
    expect(fetchApi).toHaveBeenCalledTimes(3)
    expect(app.reloadNodeDefs).toHaveBeenCalledOnce()
    expect(registry.catalog.value?.pins).toContain(other.revision_id)
    expect(
      fetchApi.mock.calls
        .slice(1)
        .map(([, init]) => JSON.parse(String(init?.body)).pinned)
    ).toEqual([true, true])
  })

  it('does not mutate the new workspace when a switch occurs while resolving graph packs', async () => {
    fetchApi.mockImplementationOnce(async () => {
      workspace.activeWorkspaceId = 'workspace-b'
      workspace.workspaceTransitionGeneration++
      return Response.json(fixture())
    })
    const registry = useCloudNodeRegistry()
    expect(
      await registry.autoPinGraphPacks(
        { nodes: [{ id: 1, type: 'ExampleNode' }] },
        {}
      )
    ).toBe(false)
    expect(fetchApi).toHaveBeenCalledOnce()
  })
})
