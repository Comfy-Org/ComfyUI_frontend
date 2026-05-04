import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodesSnapshot } from '../data/cloudNodes'
import type * as ObjectInfoParser from '@comfyorg/object-info-parser'

const fetchRegistryPacksMock = vi.hoisted(() => vi.fn(async () => new Map()))
const sanitizeCallSpy = vi.hoisted(() => vi.fn())

vi.mock('./cloudNodes.registry', () => ({
  DEFAULT_REGISTRY_BASE_URL: 'https://api.comfy.org',
  fetchRegistryPacks: fetchRegistryPacksMock
}))

vi.mock('@comfyorg/object-info-parser', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof ObjectInfoParser
  return {
    ...actual,
    sanitizeUserContent: (
      defs: Parameters<typeof actual.sanitizeUserContent>[0]
    ) => {
      sanitizeCallSpy(defs)
      return actual.sanitizeUserContent(defs)
    }
  }
})

import {
  fetchCloudNodesForBuild,
  resetCloudNodesFetcherForTests
} from './cloudNodes'

const BASE_URL = 'https://cloud.test'
const KEY = 'cloud-secret'

function validNode(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    name: 'ImpactNode',
    display_name: 'Impact Node',
    description: 'Node description',
    category: 'impact/testing',
    output_node: false,
    python_module: 'custom_nodes.comfyui-impact-pack.nodes',
    ...overrides
  }
}

function response(body: unknown, init: Partial<ResponseInit> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  })
}

function makeSnapshot(packCount = 1): NodesSnapshot {
  const packs = Array.from({ length: packCount }, (_, i) => ({
    id: `snapshot-pack-${i}`,
    displayName: `Snapshot Pack ${i}`,
    nodes: [
      {
        name: `SnapshotNode${i}`,
        displayName: `Snapshot Node ${i}`,
        category: 'snapshot'
      }
    ]
  }))

  return {
    fetchedAt: '2026-04-01T00:00:00.000Z',
    packs
  }
}

function withSnapshotDir(snapshot: NodesSnapshot | null): URL {
  const dir = mkdtempSync(join(tmpdir(), 'cloud-nodes-test-'))
  const file = join(dir, 'cloud-nodes.snapshot.json')
  if (snapshot) writeFileSync(file, JSON.stringify(snapshot))
  return pathToFileURL(file)
}

describe('fetchCloudNodesForBuild', () => {
  const savedCloudApiKey = process.env.WEBSITE_CLOUD_API_KEY

  beforeEach(() => {
    resetCloudNodesFetcherForTests()
    fetchRegistryPacksMock.mockReset()
    fetchRegistryPacksMock.mockResolvedValue(new Map())
    sanitizeCallSpy.mockReset()
    delete process.env.WEBSITE_CLOUD_API_KEY
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.WEBSITE_CLOUD_API_KEY = savedCloudApiKey
  })

  it('returns fresh when API succeeds', async () => {
    fetchRegistryPacksMock.mockResolvedValue(
      new Map([
        [
          'comfyui-impact-pack',
          {
            id: 'comfyui-impact-pack',
            name: 'ComfyUI Impact Pack',
            repository: 'https://github.com/ltdrdata/ComfyUI-Impact-Pack'
          }
        ]
      ])
    )

    const fetchImpl = vi.fn(async () => response({ ImpactNode: validNode() }))
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.droppedCount).toBe(0)
    expect(outcome.snapshot.packs).toHaveLength(1)
    expect(outcome.snapshot.packs[0]?.repoUrl).toBe(
      'https://github.com/ltdrdata/ComfyUI-Impact-Pack'
    )
  })

  it('drops invalid nodes individually and keeps valid nodes', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () =>
      response({
        ValidNode: validNode({ name: 'ValidNode' }),
        BrokenNode: {
          name: 'BrokenNode',
          python_module: 'custom_nodes.some-pack'
        }
      })
    )
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.droppedCount).toBe(1)
    expect(outcome.droppedNodes[0]?.name).toBe('BrokenNode')
    expect(outcome.snapshot.packs[0]?.nodes).toHaveLength(1)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('applies sanitizer before grouping', async () => {
    const fetchImpl = vi.fn(async () =>
      response({
        LoadImage: validNode({
          name: 'LoadImage',
          python_module: 'nodes',
          input: {
            required: {
              image: [['private.png', 'public.webp'], {}]
            }
          }
        }),
        ImpactNode: validNode({
          input: {
            required: {
              choice: [['safe', 'movie.mov'], {}]
            }
          }
        })
      })
    )

    await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(sanitizeCallSpy).toHaveBeenCalledTimes(1)
  })

  it('returns stale with missing env when snapshot is present', async () => {
    const snapshot = makeSnapshot()
    const snapshotUrl = withSnapshotDir(snapshot)
    const fetchImpl = vi.fn()
    const outcome = await fetchCloudNodesForBuild({
      snapshotUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^missing /)
    expect(fetchImpl).not.toHaveBeenCalled()
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('returns failed when env and snapshot are missing', async () => {
    const snapshotUrl = withSnapshotDir(null)
    const outcome = await fetchCloudNodesForBuild({
      snapshotUrl,
      fetchImpl: vi.fn() as unknown as typeof fetch
    })
    expect(outcome.status).toBe('failed')
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('does not retry on HTTP 401', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response({}, { status: 401 }))
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^HTTP 401/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('retries 5xx then falls back to snapshot', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response({}, { status: 503 }))
    const sleep = vi.fn(async () => undefined)
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      snapshotUrl,
      retryDelaysMs: [1, 1, 1],
      sleep,
      fetchImpl: fetchImpl as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep).toHaveBeenCalledTimes(3)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('falls back to snapshot on envelope schema mismatch', async () => {
    const snapshotUrl = withSnapshotDir(makeSnapshot())
    const fetchImpl = vi.fn(async () => response(['unexpected-array-envelope']))
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      snapshotUrl,
      fetchImpl: fetchImpl as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.reason).toMatch(/^envelope schema/)
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('memoizes within a single process', async () => {
    const fetchImpl = vi.fn(async () => response({ ImpactNode: validNode() }))
    const opts = {
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    }

    const [a, b] = await Promise.all([
      fetchCloudNodesForBuild(opts),
      fetchCloudNodesForBuild(opts)
    ])

    expect(a).toBe(b)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns fresh even when registry enrichment fails', async () => {
    fetchRegistryPacksMock.mockResolvedValue(new Map())
    const fetchImpl = vi.fn(async () => response({ ImpactNode: validNode() }))
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })
    expect(outcome.status).toBe('fresh')
  })
})
