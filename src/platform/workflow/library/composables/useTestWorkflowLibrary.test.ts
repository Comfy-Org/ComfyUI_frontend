import type {
  TestWorkflowDetail,
  TestWorkflowPage
} from '@comfyorg/ingest-types/test-workflows'
import { createHash, webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { zTestWorkflowImportMetadata } from '@comfyorg/ingest-types/test-workflows/zod'
import cloudMetadata from '@/platform/community/fixtures/cloud-reference-v1/import.json'
import cloudOriginal from '@/platform/community/fixtures/cloud-reference-v1/workflow.json?raw'
import cloudAdapted from '@/platform/community/fixtures/cloud-reference-v1/workflow.cloud.json?raw'
import archiveDetail from '@/platform/workflow/library/fixtures/archive-only-detail.json'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  handleFile: vi.fn(),
  report: vi.fn()
}))
vi.mock('@/scripts/api', () => ({ api: { fetchApi: mocks.fetch } }))
vi.mock('@/scripts/app', () => ({ app: { handleFile: mocks.handleFile } }))
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.report
}))
const scope = ref<string | null>('account-a/workspace-a')
vi.mock('@/platform/customNodes/composables/useNodeAccountScope', () => ({
  useNodeAccountScope: () => ({
    scope,
    capture: () => ({ scope: scope.value }),
    current: (request: { scope: string | null }) =>
      request.scope !== null && request.scope === scope.value
  })
}))

import { useTestWorkflowLibrary } from './useTestWorkflowLibrary'

const raw =
  '{\r\n"nodes":[{"id":1,"type":"UnknownCustomNode"}],"links":[]\r\n}\r\n'
const hash = createHash('sha256').update(raw).digest('hex')
const detail: TestWorkflowDetail = {
  summary: {
    workflow_sha256: hash,
    metadata_sha256: 'a'.repeat(64),
    name: 'Unknown node original',
    description: 'Unsupported fixture',
    tags: ['test'],
    tasks: [],
    structural_cluster: 'cluster-one',
    node_count: 1,
    unresolved_pack_count: 1,
    verified: false
  },
  metadata: {
    schema_version: 1,
    workflow_sha256: hash,
    name: 'Unknown node original',
    description: 'Unsupported fixture',
    tags: ['test'],
    tasks: [],
    node_types: ['UnknownCustomNode'],
    packs: [
      { node_type: 'UnknownCustomNode', resolution: 'unknown', candidates: [] }
    ],
    models: [],
    prompts: [],
    structural_cluster: 'cluster-one',
    required_inputs: [],
    readiness: { status: 'unsupported', notes: [] },
    provenance: { source: 'synthetic fixture', license: 'test-only' }
  }
}
const page: TestWorkflowPage = {
  entries: [detail.summary],
  total: 120000,
  unresolved: 100000,
  verified: 0,
  next_cursor: 'next-page-token'
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

function setup() {
  const owner = effectScope()
  const library = owner.run(useTestWorkflowLibrary)
  if (!library) throw new Error('Expected active library scope')
  return { owner, library }
}

beforeEach(() => {
  scope.value = 'account-a/workspace-a'
  vi.stubGlobal('crypto', webcrypto)
  mocks.fetch.mockImplementation(async (route: string) => {
    if (route.endsWith('/collections'))
      return response({
        collections: [{ id: 'corpus-pilot', count: 120000 }],
        truncated: false
      })
    if (route.includes('/facets'))
      return response({
        tags: ['test'],
        tasks: [],
        packs: [],
        models: [],
        partner_nodes: [],
        media_types: [],
        truncated: false
      })
    if (route.includes('include_workflow=true'))
      return response({ ...detail, workflow_json: raw })
    if (route.includes(`/entries/${hash}`)) return response(detail)
    return response(page)
  })
  mocks.handleFile.mockResolvedValue(undefined)
})

describe('Test workflow library', () => {
  it('opens a result directly without selecting or importing a different detail', async () => {
    const { library, owner } = setup()
    await library.chooseCollection('corpus-pilot')
    expect(await library.openEntry(hash)).toBe(true)
    const file: File = mocks.handleFile.mock.calls[0][0]
    expect(await file.text()).toBe(raw)
    expect(
      mocks.fetch.mock.calls.filter(([route]) =>
        String(route).includes(`/entries/${hash}`)
      )
    ).toHaveLength(1)
    owner.stop()
  })

  it('appends once, deduplicates overlap and stops at the actual end', async () => {
    const { library, owner } = setup()
    await library.initialize()
    await library.select(hash)
    let finish: (value: Response) => void = () => {}
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        })
    )
    const pending = library.loadMore()
    expect(library.busy.value).toBe(false)
    expect(await library.loadMore()).toBe(false)
    const second = {
      ...detail.summary,
      workflow_sha256: 'b'.repeat(64),
      name: 'Second'
    }
    finish(
      response({
        ...page,
        entries: [detail.summary, second, second],
        next_cursor: ''
      })
    )
    expect(await pending).toBe(true)
    expect(library.data.value.page?.entries).toEqual([detail.summary, second])
    expect(library.data.value.selected?.summary).toEqual(detail.summary)
    expect(library.hasMore.value).toBe(false)
    const count = mocks.fetch.mock.calls.length
    expect(await library.loadMore()).toBe(false)
    expect(mocks.fetch.mock.calls).toHaveLength(count)
    owner.stop()
  })

  it('retains results after a page error and retries the same cursor', async () => {
    const { library, owner } = setup()
    await library.initialize()
    mocks.fetch.mockResolvedValueOnce(response({}, 503))
    expect(await library.loadMore()).toBe(false)
    expect(library.state.value).toMatchObject({
      phase: 'page-failed',
      status: 503
    })
    expect(library.data.value.page?.entries).toEqual([detail.summary])
    mocks.fetch.mockResolvedValueOnce(
      response({ ...page, entries: [], next_cursor: '' })
    )
    expect(await library.loadMore()).toBe(true)
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('cursor=next-page-token'),
      expect.anything()
    )
    expect(library.data.value.page?.entries).toEqual([detail.summary])
    owner.stop()
  })

  it('refuses a looping cursor without silently claiming end of results', async () => {
    const { library, owner } = setup()
    await library.initialize()
    expect(await library.loadMore()).toBe(false)
    expect(library.state.value).toMatchObject({
      phase: 'page-failed',
      status: 0
    })
    expect(library.hasMore.value).toBe(true)
    expect(library.data.value.page?.entries).toEqual([detail.summary])
    owner.stop()
  })

  it('preserves the current page when a subsequent page belongs to a different corpus version', async () => {
    const baseline = mocks.fetch.getMockImplementation()
    mocks.fetch.mockImplementation((route: string, options: RequestInit) =>
      route.includes('/entries?')
        ? response({ ...page, corpus_version: 'original' })
        : baseline?.(route, options)
    )
    const { library, owner } = setup()
    await library.initialize()
    mocks.fetch.mockResolvedValueOnce(
      response({ ...page, corpus_version: 'changed', next_cursor: '' })
    )
    expect(await library.loadMore()).toBe(false)
    expect(library.state.value.phase).toBe('page-failed')
    expect(library.data.value.page?.corpus_version).toBe('original')
    owner.stop()
  })

  it.for(['search', 'collection', 'account', 'dispose'] as const)(
    'denies a late page after %s changes',
    async (change) => {
      const { library, owner } = setup()
      await library.initialize()
      let finish: (value: Response) => void = () => {}
      let signal: AbortSignal | null | undefined
      mocks.fetch.mockImplementationOnce(
        (_route: string, options: RequestInit) => {
          signal = options.signal
          return new Promise<Response>((resolve) => {
            finish = resolve
          })
        }
      )
      const pending = library.loadMore()
      if (change === 'search') await library.search({ model: 'new-model' })
      if (change === 'collection') await library.chooseCollection('other')
      if (change === 'account') scope.value = 'account-b/workspace-b'
      if (change === 'dispose') owner.stop()
      expect(signal?.aborted).toBe(true)
      const before = library.data.value
      finish(
        response({
          ...page,
          entries: [{ ...detail.summary, name: 'Stale result' }],
          next_cursor: ''
        })
      )
      expect(await pending).toBe(false)
      expect(library.data.value).toEqual(before)
      owner.stop()
    }
  )

  it('gives detail selection priority over append and prevents a late detail reopening after Close', async () => {
    const { library, owner } = setup()
    await library.initialize()
    let finishPage: (value: Response) => void = () => {}
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishPage = resolve
        })
    )
    const append = library.loadMore()
    expect(await library.select(hash)).toBe(true)
    finishPage(response({ ...page, next_cursor: '' }))
    expect(await append).toBe(false)
    expect(library.data.value.selected?.summary).toEqual(detail.summary)
    let finishDetail: (value: Response) => void = () => {}
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishDetail = resolve
        })
    )
    const selection = library.select(hash)
    library.closeDetails()
    finishDetail(response(detail))
    expect(await selection).toBe(false)
    expect(library.data.value.selected).toBeNull()
    owner.stop()
  })
  it('selects an archive-only original and opens only its SHA-matching bytes', async () => {
    const archive = {
      ...archiveDetail,
      summary: { ...archiveDetail.summary, workflow_sha256: hash }
    }
    mocks.fetch.mockImplementation(async (route: string) =>
      response(
        route.includes('include_workflow=true')
          ? { ...archive, workflow_json: raw }
          : archive
      )
    )
    const { library, owner } = setup()
    library.collection.value = 'corpus-pilot'
    expect(await library.select(hash)).toBe(true)
    expect(library.data.value.selected?.metadata).toBeUndefined()
    expect(mocks.handleFile).not.toHaveBeenCalled()
    expect(await library.open()).toBe(true)
    const file: File = mocks.handleFile.mock.calls[0][0]
    expect(await file.text()).toBe(raw)
    owner.stop()
  })

  it('refuses substituted archive originals and a Cloud variant without an adaptation ledger', async () => {
    const archive = {
      ...archiveDetail,
      summary: { ...archiveDetail.summary, workflow_sha256: hash }
    }
    mocks.fetch.mockResolvedValue(response(archive))
    const { library, owner } = setup()
    library.collection.value = 'corpus-pilot'
    expect(await library.select(hash)).toBe(true)
    mocks.fetch.mockResolvedValue(
      response({ ...archive, workflow_json: raw + ' ' })
    )
    expect(await library.open()).toBe(false)
    mocks.fetch.mockResolvedValue(response({ ...archive, workflow_json: raw }))
    expect(await library.open('cloud')).toBe(false)
    expect(mocks.handleFile).not.toHaveBeenCalled()
    owner.stop()
  })

  it('opens the only available collection without loading any originals', async () => {
    const { library, owner } = setup()
    expect(await library.initialize()).toBe(true)
    expect(library.collection.value).toBe('corpus-pilot')
    expect(library.data.value.page?.entries).toEqual([detail.summary])
    expect(mocks.handleFile).not.toHaveBeenCalled()
    expect(
      mocks.fetch.mock.calls.every(
        ([route]) => !String(route).includes('include_workflow=true')
      )
    ).toBe(true)
    owner.stop()
  })

  it('requires an explicit collection choice when more than one is available', async () => {
    mocks.fetch.mockResolvedValueOnce(
      response({
        collections: [
          { id: 'corpus-pilot', count: 120000 },
          { id: 'other-collection', count: 3 }
        ],
        truncated: false
      })
    )
    const { library, owner } = setup()
    expect(await library.initialize()).toBe(true)
    expect(library.collection.value).toBe('')
    expect(library.data.value.page).toBeNull()
    expect(mocks.fetch).toHaveBeenCalledOnce()
    owner.stop()
  })

  it('opens the explicitly chosen adapted graph and keeps the immutable original separately openable', async () => {
    const cloudRecord = {
      ...detail,
      summary: {
        ...detail.summary,
        workflow_sha256: cloudMetadata.workflow_sha256
      },
      metadata: zTestWorkflowImportMetadata.parse(cloudMetadata),
      community_cloud_adaptation_available: true,
      workflow_json: cloudOriginal,
      community_cloud_workflow_json: cloudAdapted
    }
    mocks.fetch.mockImplementation(async () => response(cloudRecord))
    const { library, owner } = setup()
    library.collection.value = 'harvey-qa'
    expect(await library.select(cloudMetadata.workflow_sha256)).toBe(true)
    expect(mocks.handleFile).not.toHaveBeenCalled()
    expect(await library.open('cloud')).toBe(true)
    const cloudFile: File = mocks.handleFile.mock.calls[0][0]
    expect(await cloudFile.text()).toBe(cloudAdapted)
    expect(cloudFile.name).toContain('-cloud-')
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('include_cloud_workflow=true'),
      expect.anything()
    )
    expect(await library.open()).toBe(true)
    const originalFile: File = mocks.handleFile.mock.calls[1][0]
    expect(await originalFile.text()).toBe(cloudOriginal)
    owner.stop()
  })

  it('never falls back to original loading when an explicitly requested adaptation fails validation', async () => {
    mocks.fetch.mockImplementation(async () =>
      response({
        ...detail,
        summary: {
          ...detail.summary,
          workflow_sha256: cloudMetadata.workflow_sha256
        },
        metadata: zTestWorkflowImportMetadata.parse(cloudMetadata),
        workflow_json: cloudOriginal,
        community_cloud_workflow_json: cloudAdapted + ' '
      })
    )
    const { library, owner } = setup()
    library.collection.value = 'harvey-qa'
    await library.select(cloudMetadata.workflow_sha256)
    expect(await library.open('cloud')).toBe(false)
    expect(mocks.handleFile).not.toHaveBeenCalled()
    expect(library.state.value.phase).toBe('failed')
    owner.stop()
  })
  it('retains structured inputs and source evidence through the generated response validator', async () => {
    const source = '{\r\n"source":"unchanged observation"\r\n}\r\n'
    const extended: TestWorkflowDetail = {
      ...detail,
      source_metadata_json: source,
      source_metadata_sha256: createHash('sha256').update(source).digest('hex'),
      metadata: {
        ...detail.metadata,
        safety: { status: 'unreviewed' },
        model_verification: { status: 'unresolved', inventory_sha256: null },
        cloud_adaptation: {
          status: 'blocked',
          blocked_references: ['fixture']
        },
        packs: [
          {
            node_type: 'UnknownCustomNode',
            resolution: 'recorded',
            evidence: { location: '/nodes/0' },
            candidates: [
              {
                pack_id: '',
                owner: '',
                repository: '',
                legacy_reference: 'Unresolved source reference',
                observation: 'not authority'
              }
            ]
          }
        ],
        models: [
          {
            kind: 'other',
            name: 'fixture-model',
            loader: 'UnknownCustomNode',
            location: '/nodes/0/widgets_values/0',
            identity: { status: 'unresolved' },
            verification: {
              identity_status: 'unresolved',
              execution: 'unverified'
            }
          }
        ],
        required_inputs: [
          {
            node_type: 'UnknownCustomNode',
            location: '/nodes/0',
            availability: 'unverified',
            recorded_widgets: ['external-input'],
            evidence: { kind: 'captured' }
          }
        ],
        provenance: {
          ...detail.metadata.provenance,
          capture: { sha256: hash }
        },
        readiness: { ...detail.metadata.readiness, observation: 'not executed' }
      }
    }
    mocks.fetch.mockResolvedValueOnce(response(extended))
    const { library, owner } = setup()
    library.collection.value = 'corpus-pilot'
    expect(await library.select(hash)).toBe(true)
    expect(library.data.value.selected).toEqual(extended)
    expect(mocks.handleFile).not.toHaveBeenCalled()
    owner.stop()
  })
  it('loads summaries in bounded pages, including unsupported graphs without auto-execution', async () => {
    const { library, owner } = setup()
    expect(await library.initialize()).toBe(true)
    expect(await library.chooseCollection('corpus-pilot')).toBe(true)
    expect(library.data.value.page?.total).toBe(120000)
    expect(library.data.value.page?.entries).toEqual([detail.summary])
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/entries?limit=24'),
      expect.objectContaining({ cache: 'no-store' })
    )
    expect(mocks.handleFile).not.toHaveBeenCalled()
    await library.loadMore()
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('cursor=next-page-token'),
      expect.anything()
    )
    owner.stop()
  })

  it('opens only on request using the exact original file and normal graph loader', async () => {
    const { library, owner } = setup()
    await library.chooseCollection('corpus-pilot')
    await library.select(hash)
    expect(mocks.handleFile).not.toHaveBeenCalled()
    expect(library.data.value.selected?.metadata?.node_types).toEqual([
      'UnknownCustomNode'
    ])
    expect(await library.open()).toBe(true)
    const file: File = mocks.handleFile.mock.calls[0][0]
    expect(file.name).toBe(`test-workflow-${hash.slice(0, 12)}.json`)
    expect(await file.text()).toBe(raw)
    expect(
      mocks.fetch.mock.calls.every(
        ([route]) => !String(route).includes('/prompt')
      )
    ).toBe(true)
    owner.stop()
  })

  it('refuses substituted original bytes before loading the graph', async () => {
    const { library, owner } = setup()
    await library.chooseCollection('corpus-pilot')
    await library.select(hash)
    mocks.fetch.mockResolvedValueOnce(
      response({ ...detail, workflow_json: raw + ' ' })
    )
    expect(await library.open()).toBe(false)
    expect(mocks.handleFile).not.toHaveBeenCalled()
    expect(library.state.value.phase).toBe('failed')
    owner.stop()
  })

  it('clears private data and denies a late response after workspace changes', async () => {
    const { library, owner } = setup()
    await library.initialize()
    let resolve: (value: Response) => void = () => {
      throw new Error('Request not pending')
    }
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
    const pending = library.chooseCollection('corpus-pilot')
    scope.value = 'account-a/workspace-b'
    resolve(response(page))
    expect(await pending).toBe(false)
    expect(library.data.value.collections).toEqual([])
    expect(library.data.value.page).toBeNull()
    expect(library.collection.value).toBe('')
    owner.stop()
  })

  it('rejects malformed metadata and keeps failed server calls actionable', async () => {
    const { library, owner } = setup()
    mocks.fetch.mockResolvedValueOnce(response({ entries: [] }))
    expect(await library.initialize()).toBe(false)
    expect(library.state.value.phase).toBe('failed')
    mocks.fetch.mockResolvedValueOnce(response({}, 401))
    expect(await library.initialize()).toBe(false)
    expect(library.state.value).toMatchObject({ phase: 'failed', status: 401 })
    owner.stop()
  })

  it('encodes exact facet values and structural cluster without converting anything', async () => {
    const { library, owner } = setup()
    await library.chooseCollection('corpus-pilot')
    await library.search({
      tag: 'a&b',
      pack: 'owner/pack',
      model: 'checkpoint/name & version.safetensors',
      complexity: 'medium',
      partner_node: 'Partner/ExactClass',
      media_type: 'video',
      cluster: 'same variant'
    })
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        'tag=a%26b&pack=owner%2Fpack&model=checkpoint%2Fname+%26+version.safetensors&complexity=medium&partner_node=Partner%2FExactClass&media_type=video&cluster=same+variant'
      ),
      expect.anything()
    )
    owner.stop()
  })
})
