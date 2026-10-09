import type {
  TestWorkflowDetail,
  TestWorkflowPage
} from '@comfyorg/ingest-types/test-workflows'
import { createHash, webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

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
  it('retains structured inputs and source evidence through the generated response validator', async () => {
    const source = '{\r\n"source":"unchanged observation"\r\n}\r\n'
    const extended: TestWorkflowDetail = {
      ...detail,
      source_metadata_json: source,
      source_metadata_sha256: createHash('sha256').update(source).digest('hex'),
      metadata: {
        ...detail.metadata,
        safety: { status: 'unreviewed' },
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
            identity: { status: 'unresolved' }
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
    await library.search(undefined, page.next_cursor)
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
    expect(library.data.value.selected?.metadata.node_types).toEqual([
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
      cluster: 'same variant'
    })
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        'tag=a%26b&pack=owner%2Fpack&cluster=same+variant'
      ),
      expect.anything()
    )
    owner.stop()
  })
})
