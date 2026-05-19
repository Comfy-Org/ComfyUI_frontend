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
  const savedCloudNodesFixture = process.env.WEBSITE_CLOUD_NODES_FIXTURE

  beforeEach(() => {
    resetCloudNodesFetcherForTests()
    fetchRegistryPacksMock.mockReset()
    fetchRegistryPacksMock.mockResolvedValue(new Map())
    sanitizeCallSpy.mockReset()
    delete process.env.WEBSITE_CLOUD_API_KEY
    delete process.env.WEBSITE_CLOUD_NODES_FIXTURE
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (savedCloudApiKey === undefined) {
      delete process.env.WEBSITE_CLOUD_API_KEY
    } else {
      process.env.WEBSITE_CLOUD_API_KEY = savedCloudApiKey
    }
    if (savedCloudNodesFixture === undefined) {
      delete process.env.WEBSITE_CLOUD_NODES_FIXTURE
    } else {
      process.env.WEBSITE_CLOUD_NODES_FIXTURE = savedCloudNodesFixture
    }
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

  it('throws when called twice with materially different options', async () => {
    const fetchImpl = vi.fn(async () => response({ ImpactNode: validNode() }))
    await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(() =>
      fetchCloudNodesForBuild({
        apiKey: 'different-key',
        baseUrl: BASE_URL,
        fetchImpl: fetchImpl as typeof fetch
      })
    ).toThrow(/called twice with different options/)
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

  it('falls back to the raw upstream id for registryId when registry lookup misses', async () => {
    fetchRegistryPacksMock.mockResolvedValue(new Map())
    const fetchImpl = vi.fn(async () =>
      response({
        QwenNode: validNode({
          name: 'QwenNode',
          python_module: 'custom_nodes.ComfyUI_QwenVL.nodes'
        })
      })
    )
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.packs[0]?.id).toBe('comfyui-qwenvl')
    expect(outcome.snapshot.packs[0]?.registryId).toBe('ComfyUI_QwenVL')
  })

  it('falls back to the raw upstream id for registryId when fetchRegistryPacks throws', async () => {
    fetchRegistryPacksMock.mockImplementation(async () => {
      throw new Error('registry unreachable')
    })
    const fetchImpl = vi.fn(async () =>
      response({
        QwenNode: validNode({
          name: 'QwenNode',
          python_module: 'custom_nodes.ComfyUI_QwenVL.nodes'
        })
      })
    )
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.packs[0]?.registryId).toBe('ComfyUI_QwenVL')
  })

  it('slugifies pack ids while querying the registry with the raw id', async () => {
    fetchRegistryPacksMock.mockResolvedValue(
      new Map([
        [
          'ComfyUI_QwenVL',
          {
            id: 'ComfyUI_QwenVL',
            name: 'ComfyUI QwenVL',
            repository: 'https://github.com/example/ComfyUI_QwenVL'
          }
        ]
      ])
    )

    const fetchImpl = vi.fn(async () =>
      response({
        QwenNode: validNode({
          name: 'QwenNode',
          python_module: 'custom_nodes.ComfyUI_QwenVL.nodes'
        })
      })
    )
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.packs[0]?.id).toBe('comfyui-qwenvl')
    expect(outcome.snapshot.packs[0]?.registryId).toBe('ComfyUI_QwenVL')
    expect(fetchRegistryPacksMock).toHaveBeenCalledWith(
      ['ComfyUI_QwenVL'],
      expect.anything()
    )
  })

  it('queries every raw-id alias when packs collide on the same slug and picks the first hit', async () => {
    fetchRegistryPacksMock.mockResolvedValue(
      new Map<string, unknown>([
        ['ComfyUI-QwenVL', null],
        [
          'ComfyUI_QwenVL',
          {
            id: 'ComfyUI_QwenVL',
            name: 'ComfyUI QwenVL',
            repository: 'https://github.com/example/ComfyUI_QwenVL'
          }
        ]
      ])
    )

    const fetchImpl = vi.fn(async () =>
      response({
        QwenDash: validNode({
          name: 'QwenDash',
          python_module: 'custom_nodes.ComfyUI-QwenVL.nodes'
        }),
        QwenUnder: validNode({
          name: 'QwenUnder',
          python_module: 'custom_nodes.ComfyUI_QwenVL.nodes'
        })
      })
    )
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.packs).toHaveLength(1)
    expect(outcome.snapshot.packs[0]?.id).toBe('comfyui-qwenvl')
    expect(outcome.snapshot.packs[0]?.registryId).toBe('ComfyUI_QwenVL')
    expect(outcome.snapshot.packs[0]?.repoUrl).toBe(
      'https://github.com/example/ComfyUI_QwenVL'
    )
    expect(fetchRegistryPacksMock).toHaveBeenCalledWith(
      ['ComfyUI-QwenVL', 'ComfyUI_QwenVL'],
      expect.anything()
    )
  })

  it('prefers the first non-null registry result when every alias resolves', async () => {
    fetchRegistryPacksMock.mockResolvedValue(
      new Map<string, unknown>([
        [
          'ComfyUI-QwenVL',
          {
            id: 'ComfyUI-QwenVL',
            name: 'Dash Variant',
            repository: 'https://github.com/example/dash-first'
          }
        ],
        [
          'ComfyUI_QwenVL',
          {
            id: 'ComfyUI_QwenVL',
            name: 'Underscore Variant',
            repository: 'https://github.com/example/underscore-second'
          }
        ]
      ])
    )

    const fetchImpl = vi.fn(async () =>
      response({
        QwenDash: validNode({
          name: 'QwenDash',
          python_module: 'custom_nodes.ComfyUI-QwenVL.nodes'
        }),
        QwenUnder: validNode({
          name: 'QwenUnder',
          python_module: 'custom_nodes.ComfyUI_QwenVL.nodes'
        })
      })
    )
    const outcome = await fetchCloudNodesForBuild({
      apiKey: KEY,
      baseUrl: BASE_URL,
      fetchImpl: fetchImpl as typeof fetch
    })

    expect(outcome.status).toBe('fresh')
    if (outcome.status !== 'fresh') return
    expect(outcome.snapshot.packs).toHaveLength(1)
    expect(outcome.snapshot.packs[0]?.registryId).toBe('ComfyUI-QwenVL')
    expect(outcome.snapshot.packs[0]?.repoUrl).toBe(
      'https://github.com/example/dash-first'
    )
    expect(fetchRegistryPacksMock).toHaveBeenCalledWith(
      ['ComfyUI-QwenVL', 'ComfyUI_QwenVL'],
      expect.anything()
    )
  })

  it('normalizes pack ids when reading a fallback snapshot', async () => {
    const snapshotUrl = withSnapshotDir({
      fetchedAt: '2026-04-01T00:00:00.000Z',
      packs: [
        {
          id: 'ComfyUI-Crystools',
          displayName: 'ComfyUI-Crystools',
          nodes: [
            {
              name: 'CrystoolsNode',
              displayName: 'Crystools Node',
              category: 'x'
            }
          ]
        },
        {
          id: 'basic_data_handling',
          displayName: 'basic_data_handling',
          nodes: [
            { name: 'BasicNode', displayName: 'Basic Node', category: 'x' }
          ]
        }
      ]
    })

    const outcome = await fetchCloudNodesForBuild({
      snapshotUrl,
      fetchImpl: vi.fn() as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.snapshot.packs.map((p) => p.id)).toEqual([
      'comfyui-crystools',
      'basic-data-handling'
    ])
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('merges packs in the fallback snapshot whose ids slugify to the same value', async () => {
    const snapshotUrl = withSnapshotDir({
      fetchedAt: '2026-04-01T00:00:00.000Z',
      packs: [
        {
          id: 'ComfyUI-QwenVL',
          displayName: 'ComfyUI QwenVL',
          nodes: [{ name: 'A', displayName: 'A', category: 'x' }]
        },
        {
          id: 'ComfyUI_QwenVL',
          displayName: 'ComfyUI QwenVL',
          nodes: [{ name: 'B', displayName: 'B', category: 'x' }]
        }
      ]
    })

    const outcome = await fetchCloudNodesForBuild({
      snapshotUrl,
      fetchImpl: vi.fn() as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    expect(outcome.snapshot.packs).toHaveLength(1)
    expect(outcome.snapshot.packs[0]?.id).toBe('comfyui-qwenvl')
    expect(outcome.snapshot.packs[0]?.nodes.map((n) => n.name).sort()).toEqual([
      'A',
      'B'
    ])
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('preserves optional metadata from later aliases when snapshot packs collide on slug', async () => {
    const snapshotUrl = withSnapshotDir({
      fetchedAt: '2026-04-01T00:00:00.000Z',
      packs: [
        {
          id: 'ComfyUI-QwenVL',
          displayName: 'ComfyUI QwenVL',
          nodes: [{ name: 'A', displayName: 'A', category: 'x' }]
        },
        {
          id: 'ComfyUI_QwenVL',
          displayName: 'ComfyUI QwenVL',
          registryId: 'ComfyUI_QwenVL',
          description: 'rich description from the underscore variant',
          repoUrl: 'https://github.com/example/ComfyUI_QwenVL',
          publisher: { id: 'qwen-team', name: 'Qwen Team' },
          downloads: 1234,
          githubStars: 7,
          license: 'MIT',
          nodes: [{ name: 'B', displayName: 'B', category: 'x' }]
        }
      ]
    })

    const outcome = await fetchCloudNodesForBuild({
      snapshotUrl,
      fetchImpl: vi.fn() as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    const merged = outcome.snapshot.packs[0]
    expect(merged?.id).toBe('comfyui-qwenvl')
    expect(merged?.registryId).toBe('ComfyUI_QwenVL')
    expect(merged?.description).toBe(
      'rich description from the underscore variant'
    )
    expect(merged?.repoUrl).toBe('https://github.com/example/ComfyUI_QwenVL')
    expect(merged?.publisher).toEqual({ id: 'qwen-team', name: 'Qwen Team' })
    expect(merged?.downloads).toBe(1234)
    expect(merged?.githubStars).toBe(7)
    expect(merged?.license).toBe('MIT')
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })

  it('does not overwrite metadata already present on the first slug-collided pack', async () => {
    const snapshotUrl = withSnapshotDir({
      fetchedAt: '2026-04-01T00:00:00.000Z',
      packs: [
        {
          id: 'ComfyUI-QwenVL',
          displayName: 'first wins',
          registryId: 'ComfyUI-QwenVL',
          repoUrl: 'https://github.com/example/ComfyUI-QwenVL',
          nodes: [{ name: 'A', displayName: 'A', category: 'x' }]
        },
        {
          id: 'ComfyUI_QwenVL',
          displayName: 'second loses',
          registryId: 'ComfyUI_QwenVL',
          repoUrl: 'https://github.com/example/ComfyUI_QwenVL',
          nodes: [{ name: 'B', displayName: 'B', category: 'x' }]
        }
      ]
    })

    const outcome = await fetchCloudNodesForBuild({
      snapshotUrl,
      fetchImpl: vi.fn() as unknown as typeof fetch
    })
    expect(outcome.status).toBe('stale')
    if (outcome.status !== 'stale') return
    const merged = outcome.snapshot.packs[0]
    expect(merged?.displayName).toBe('first wins')
    expect(merged?.registryId).toBe('ComfyUI-QwenVL')
    expect(merged?.repoUrl).toBe('https://github.com/example/ComfyUI-QwenVL')
    rmSync(new URL('.', snapshotUrl), { recursive: true, force: true })
  })
})
