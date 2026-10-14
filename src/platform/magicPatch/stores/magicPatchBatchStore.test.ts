import type {
  CloudNodeRegistry,
  CloudNodeRegistryRevision
} from '@comfyorg/ingest-types'
import type { RequestStatus } from '@comfyorg/magic-patch-types'
import { createHash, webcrypto } from 'node:crypto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useMagicPatchBatchStore } from './magicPatchBatchStore'
import type { PackConversion } from './magicPatchBatchStore'
import type { MissingNodeType } from '@/types/comfy'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const mocks = vi.hoisted(() => ({
  reload: vi.fn(),
  load: vi.fn(),
  pin: vi.fn(),
  document: {} as object | null,
  documentId: 'document-a' as string | undefined,
  missing: [] as MissingNodeType[],
  definitions: {} as Record<
    string,
    {
      python_module: string
      comfy_cloud_revision_id: string
      comfy_cloud_pack_id: string
      comfy_cloud_prepared: boolean
    }
  >
}))
const scope = ref<string | null>('owner')
const graphReady = ref(true)
const catalog = ref<CloudNodeRegistry>({
  corpus_commit: 'test',
  pins: [],
  revisions: []
})
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))
vi.mock('@/scripts/app', () => ({
  app: {
    get isGraphReady() {
      return graphReady.value
    },
    reloadNodeDefs: vi.fn(),
    rootGraph: { serialize: vi.fn(() => ({ nodes: [] })) }
  }
}))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
vi.mock('@/platform/customNodes/composables/useNodeAccountScope', () => ({
  useNodeAccountScope: () => ({
    scope: computed(() => scope.value),
    capture: () => scope.value,
    current: (owner: string | null) => owner !== null && owner === scope.value
  })
}))
vi.mock('@/platform/customNodes/composables/useCloudNodeRegistry', () => ({
  useCloudNodeRegistry: () => ({ catalog, load: mocks.load, setPin: mocks.pin })
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mocks.document
    }
  })
}))
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ reloadCurrentWorkflow: mocks.reload })
}))
vi.mock('@/platform/workflow/core/utils/workflowLoadEvents', () => ({
  currentCompletedWorkflowDocumentId: () => mocks.documentId,
  onWorkflowWarningsReady: () => () => {}
}))
vi.mock('@/platform/nodeReplacement/missingNodesErrorStore', () => ({
  useMissingNodesErrorStore: () => ({
    get missingNodesError() {
      return mocks.missing.length ? { nodeTypes: mocks.missing } : null
    }
  })
}))
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    get nodeDefsByName() {
      return mocks.definitions
    }
  })
}))

const first: CloudNodeRegistryRevision = {
  revision_id: 'a'.repeat(64),
  pack_id: 'randomnumbers',
  name: 'RandomNumbers',
  upstream_commit: 'b'.repeat(40),
  source_sha256: 'c'.repeat(64),
  manifest_sha256: 'd'.repeat(64),
  dependency_profile_sha256: 'e'.repeat(64),
  nodes: ['RandomNumber'],
  prepared: false,
  pinned: false,
  node_api_version: 1
}
const second: CloudNodeRegistryRevision = {
  ...first,
  revision_id: '1'.repeat(64),
  pack_id: 'second',
  name: 'Second',
  nodes: ['SecondNode']
}
const sources = [first, second]
const releases = ['f'.repeat(64), '2'.repeat(64)]
const nativeNames = ['User_owner_RandomNumber', 'User_owner_SecondNode']
let states: RequestStatus['state'][]
let submitted: number
let reports: string[]
let digests: (string | undefined)[]
let statusVersion: number
let includeRelease: boolean
const status = (index: number): RequestStatus => ({
  id: (index ? '3' : '4').repeat(32),
  operation_id: (index ? '5' : '6').repeat(32),
  state: states[index] ?? 'ready',
  operation_status: 'completed',
  status_version: statusVersion,
  ...(includeRelease ? { release_id: '9'.repeat(64) } : {}),
  report_sha256: digests[index]
})

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  setActivePinia(createPinia())
  scope.value = 'owner'
  mocks.document = {}
  mocks.documentId = 'document-a'
  mocks.missing = []
  vi.mocked(app.rootGraph.serialize).mockReturnValue(new LGraph().serialize())
  graphReady.value = true
  states = ['ready', 'ready']
  submitted = 0
  statusVersion = 2
  includeRelease = true
  reports = sources.map((source, index) =>
    JSON.stringify({
      publication_association: {
        schema: 'magic-patch-publication/v1',
        request_id: (index ? '3' : '4').repeat(32),
        source_pack_id: source.pack_id,
        source_revision_id: source.revision_id,
        installed_pack_id: `user-owner/pack-${index}`,
        installed_revision_id: releases[index],
        node_types: { [source.nodes[0]!]: nativeNames[index] }
      }
    })
  )
  digests = reports.map((report) =>
    createHash('sha256').update(report).digest('hex')
  )
  catalog.value = {
    corpus_commit: 'test',
    pins: [],
    revisions: sources.map((source, index) => ({
      ...source,
      revision_id: releases[index]!,
      pack_id: `user-owner/pack-${index}`,
      upstream_commit: '',
      nodes: [nativeNames[index]!],
      account_owned: true,
      prepared: true,
      node_api_version: 2
    }))
  }
  mocks.definitions = Object.fromEntries(
    nativeNames.map((name, index) => [
      name,
      {
        python_module: 'custom_nodes.cloud_registry.actual_module',
        comfy_cloud_revision_id: releases[index]!,
        comfy_cloud_pack_id: `user-owner/pack-${index}`,
        comfy_cloud_prepared: true
      }
    ])
  )
  mocks.load.mockResolvedValue(true)
  mocks.pin.mockImplementation(async (id: string) => {
    catalog.value.pins.push(id)
    const revision = catalog.value.revisions.find(
      (item) => item.revision_id === id
    )
    if (revision) revision.pinned = true
    return true
  })
  mocks.reload.mockImplementation(async (current: () => boolean) => current())
  vi.mocked(app.reloadNodeDefs).mockResolvedValue(undefined)
  vi.mocked(api.fetchApi).mockImplementation(async (route, options) => {
    if (route === '/magic-patch/sources/pack')
      return Response.json({
        ...JSON.parse(options!.body as string),
        source_ref: '7'.repeat(64),
        entry_point: 'pack_pin'
      })
    if (route === '/magic-patch/requests')
      return Response.json(status(submitted++))
    const index = route.includes('3'.repeat(32)) ? 1 : 0
    if (route.endsWith('/report'))
      return new Response(reports[index], {
        headers: { 'X-Content-SHA256': digests[index]! }
      })
    return Response.json(status(index))
  })
})

async function settleCompletion(
  store: ReturnType<typeof useMagicPatchBatchStore>
) {
  await nextTick()
  await vi.waitFor(() => expect(store.verifying).toBe(false))
}

async function submit(packs = [first], acknowledge = true) {
  const store = useMagicPatchBatchStore()
  store.offer(packs)
  await store.confirm()
  await settleCompletion(store)
  if (acknowledge && store.ready) await store.acknowledge()
  return store
}

describe('authenticated publication completion and user reload', () => {
  it('does not revive an old workflow source after account change and a new confirmation', async () => {
    let finishOldLoad: ((value: boolean) => void) | undefined
    const oldLoad = new Promise<boolean>((resolve) => {
      finishOldLoad = resolve
    })
    mocks.load.mockReturnValueOnce(oldLoad)
    const normalFetch = vi.mocked(api.fetchApi).getMockImplementation()!
    const acquisition = {
      acquisition_id: 'a'.repeat(32),
      state: 'ready',
      status_version: 2,
      source_ref: '7'.repeat(64),
      reason: null,
      conversion_supported: true,
      message: 'Ready',
      progress: {
        stage: 'source_preparation',
        state: 'ready',
        message: 'Ready'
      },
      source: {
        pack_id: first.pack_id,
        revision_id: first.revision_id,
        registry_revision_id: first.revision_id,
        upstream_commit: first.upstream_commit,
        node_api_version: 1,
        nodes: first.nodes,
        admission: {},
        validation_prerequisites: {}
      }
    }
    vi.mocked(api.fetchApi).mockImplementation(
      async (route, options, beforeDispatch) => {
        if (route === '/magic-patch/sources/workflow')
          return Response.json(acquisition)
        if (route.startsWith('/magic-patch/workflow-source-discoveries/'))
          return Response.json({
            acquisition,
            workflow_selector: {
              cnr_id: first.pack_id,
              ver: first.upstream_commit,
              node_types: first.nodes
            },
            resolved: null
          })
        return normalFetch(route, options, beforeDispatch)
      }
    )
    const store = useMagicPatchBatchStore()
    store.offer(
      [],
      [
        {
          key: 'old',
          name: first.name,
          cnrId: first.pack_id,
          version: first.upstream_commit,
          nodeTypes: first.nodes
        }
      ]
    )
    const oldConfirm = store.confirm()
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledOnce())
    scope.value = 'new-owner'
    store.offer([second])
    const newConfirm = store.confirm()
    catalog.value.revisions.push(first)
    finishOldLoad!(true)
    await Promise.all([oldConfirm, newConfirm])
    expect(store.jobs.map((job) => job.revision.revision_id)).toEqual([
      second.revision_id
    ])
    const sourcesSent = vi
      .mocked(api.fetchApi)
      .mock.calls.filter(([route]) => route === '/magic-patch/sources/pack')
      .map(([, options]) => JSON.parse(options!.body as string))
    expect(sourcesSent).toEqual([
      { pack_id: second.pack_id, revision_id: second.revision_id }
    ])
  })

  function affectedGraph() {
    const empty = new LGraph().serialize()
    const graph = {
      id: empty.id,
      revision: empty.revision,
      last_node_id: 8,
      last_link_id: 0,
      version: empty.version,
      links: [],
      groups: [],
      nodes: sources.map((source, index) => ({
        id: index + 7,
        type: source.nodes[0]!,
        pos: [0, 0] as [number, number],
        size: [235, 160] as [number, number],
        flags: {},
        order: index,
        mode: 0,
        properties: { cnr_id: source.pack_id, ver: source.upstream_commit }
      }))
    } satisfies ComfyWorkflowJSON & ReturnType<typeof app.rootGraph.serialize>
    vi.mocked(app.rootGraph.serialize).mockReturnValue(graph)
    mocks.missing = [
      { type: 'RandomNumber', nodeId: 7, cnrId: first.pack_id },
      { type: 'SecondNode', nodeId: 8, cnrId: second.pack_id },
      { type: 'UnresolvedNode', nodeId: 9, cnrId: 'unknown' }
    ]
    return graph
  }

  it('clears only the installed pack error while another pack is still converting', async () => {
    const graph = affectedGraph()
    const before = structuredClone(graph)
    states[1] = 'waiting_install'
    const store = await submit([first, second], false)
    expect(store.installedRevisionIds).toEqual([first.revision_id])
    expect(
      store.pendingNodeErrors.map((error) =>
        typeof error === 'string' ? error : error.type
      )
    ).toEqual(['SecondNode', 'UnresolvedNode'])
    expect(mocks.missing).toHaveLength(3)
    expect(store.ready).toBe(false)
    expect(mocks.reload).not.toHaveBeenCalled()
    expect(graph).toEqual(before)
    states[1] = 'ready'
    await store.refresh()
    await settleCompletion(store)
    expect(store.pendingNodeErrors).toEqual([
      { type: 'UnresolvedNode', nodeId: 9, cnrId: 'unknown' }
    ])
    expect(store.ready).toBe(true)
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('clears a verified pack independently of a failed pack', async () => {
    affectedGraph()
    states[1] = 'failed'
    const store = await submit([first, second], false)
    expect(store.installedRevisionIds).toEqual([first.revision_id])
    expect(store.pendingNodeErrors).toHaveLength(2)
    expect(store.ready).toBe(true)
    store.dismissFinished()
    expect(store.pendingNodeErrors).toHaveLength(2)
  })
  it('reloads verified successes in a failed batch and keeps unrelated Problems entries', async () => {
    const graph = affectedGraph()
    states[1] = 'failed'
    const store = await submit([first, second], false)
    mocks.reload.mockImplementation(
      async (
        current: () => boolean,
        remap: (graph: ComfyWorkflowJSON) => ComfyWorkflowJSON
      ) => {
        const mapped = remap(structuredClone(graph))
        expect(mapped.nodes[0]!.type).toBe(nativeNames[0])
        expect(mapped.nodes[1]!.type).toBe('SecondNode')
        mocks.missing = mocks.missing.filter(
          (error) => typeof error === 'string' || error.nodeId !== 7
        )
        return current()
      }
    )
    expect(await store.acknowledge()).toBe(true)
    expect(mocks.missing).toHaveLength(2)
    expect(store.acknowledged).toBe(true)
  })
  it('rejects reload when one of the remapped target nodes is still missing', async () => {
    const graph = affectedGraph()
    const store = await submit([first], false)
    mocks.reload.mockImplementation(
      async (
        current: () => boolean,
        remap: (graph: ComfyWorkflowJSON) => ComfyWorkflowJSON
      ) => {
        remap(structuredClone(graph))
        mocks.missing = [{ type: nativeNames[0]!, nodeId: 7 }]
        return current()
      }
    )
    expect(await store.acknowledge()).toBe(false)
    expect(store.completionReason).toBe('reload_failed')
  })
  it.for(['pack', 'prepared'] as const)(
    'keeps errors when the native definition has invalid %s metadata',
    async (invalid) => {
      affectedGraph()
      const definition = mocks.definitions[nativeNames[0]!]!
      if (invalid === 'pack') definition.comfy_cloud_pack_id = 'wrong-pack'
      else definition.comfy_cloud_prepared = false
      const store = await submit([first], false)
      expect(store.pendingNodeErrors).toHaveLength(3)
      expect(store.installedRevisionIds).toEqual([])
      expect(store.completionReason).toBe('definitions_unavailable')
    }
  )
  it('retries installation verification with the same ready proof without submitting another request', async () => {
    affectedGraph()
    mocks.load.mockResolvedValue(false)
    const store = await submit([first], false)
    expect(store.pendingNodeErrors).toHaveLength(3)
    mocks.load.mockResolvedValue(true)
    await store.refresh()
    await settleCompletion(store)
    expect(store.installedRevisionIds).toEqual([first.revision_id])
    expect(store.pendingNodeErrors).toHaveLength(2)
    expect(submitted).toBe(1)
  })
  it('restores a Problems entry if its verified native revision is unpinned', async () => {
    affectedGraph()
    const store = await submit([first], false)
    expect(store.pendingNodeErrors).toHaveLength(2)
    catalog.value.pins = []
    catalog.value.revisions[0]!.pinned = false
    expect(store.pendingNodeErrors).toHaveLength(3)
    expect(store.ready).toBe(false)
  })
  it('preserves raw errors without reading the graph while graph loading is incomplete', async () => {
    affectedGraph()
    const store = await submit([first], false)
    graphReady.value = false
    vi.mocked(app.rootGraph.serialize).mockClear()
    expect(store.pendingNodeErrors).toHaveLength(3)
    expect(app.rootGraph.serialize).not.toHaveBeenCalled()
  })

  it.for(['report', 'definitions'] as const)(
    'keeps the pack error after a ready status with invalid %s',
    async (invalid) => {
      affectedGraph()
      if (invalid === 'report') reports[0] = '{}'
      else
        mocks.definitions[nativeNames[0]!]!.comfy_cloud_revision_id =
          '8'.repeat(64)
      const store = await submit([first], false)
      expect(store.installedRevisionIds).toEqual([])
      expect(mocks.missing).toHaveLength(3)
      expect(store.pendingNodeErrors).toHaveLength(3)
    }
  )

  it('does not clear errors for another workflow when conversion finishes in the background', async () => {
    affectedGraph()
    states[0] = 'waiting_install'
    const store = await submit([first], false)
    mocks.documentId = 'document-b'
    states[0] = 'ready'
    await store.refresh()
    await settleCompletion(store)
    expect(store.installedRevisionIds).toEqual([first.revision_id])
    expect(mocks.missing).toHaveLength(3)
    expect(store.pendingNodeErrors).toHaveLength(3)
  })

  it('preserves an error when the affected node was edited to another revision during conversion', async () => {
    const graph = affectedGraph()
    states[0] = 'waiting_install'
    const store = await submit([first], false)
    graph.nodes[0]!.properties!.ver = '9'.repeat(40)
    states[0] = 'ready'
    await store.refresh()
    await settleCompletion(store)
    expect(store.installedRevisionIds).toEqual([first.revision_id])
    expect(mocks.missing).toHaveLength(3)
    expect(store.pendingNodeErrors).toHaveLength(3)
    expect(graph.nodes[0]!.properties!.ver).toBe('9'.repeat(40))
  })

  it('verifies installation and waits for acknowledgement before reloading', async () => {
    const store = await submit([first], false)
    expect(store.ready).toBe(true)
    expect(store.acknowledged).toBe(false)
    expect(store.visible).toBe(true)
    expect(mocks.reload).not.toHaveBeenCalled()
    expect(await store.acknowledge()).toBe(true)
    expect(mocks.reload).toHaveBeenCalledOnce()
  })

  it('verifies saved-conversion provenance and still waits for acknowledgement', async () => {
    const report = {
      format: 'private-magic-completion-report/1',
      request_id: status(0).id,
      operation_id: status(0).operation_id,
      execution_mode: 'cached_patch',
      fresh_model_execution: false,
      native_result_sha256: 'a'.repeat(64),
      publication_association: {
        schema: 'magic-patch-publication/v2',
        request_id: status(0).id,
        source_pack_id: first.pack_id,
        source_revision_id: first.revision_id,
        installed_pack_id: 'user-owner/pack-0',
        installed_revision_id: releases[0]!,
        node_types: { [first.nodes[0]!]: nativeNames[0]! },
        source_node_stamps: [
          {
            class_type: first.nodes[0],
            cnr_id: first.pack_id,
            ver: first.revision_id
          }
        ]
      },
      cache_provenance: {
        execution_mode: 'cached_patch',
        fresh_model_execution: false,
        fresh_model_invoked: false,
        archive_id: 'b'.repeat(64),
        archive_record_sha256: 'c'.repeat(64),
        origin_request_id: '7'.repeat(32),
        origin_operation_id: '8'.repeat(32)
      }
    }
    reports[0] = JSON.stringify(report)
    digests[0] = createHash('sha256').update(reports[0]!).digest('hex')
    const store = await submit([first], false)
    expect(store.ready).toBe(true)
    expect(store.jobs[0]?.executionMode).toBe('cached_patch')
    expect(mocks.reload).not.toHaveBeenCalled()
    expect(await store.acknowledge()).toBe(true)
    expect(mocks.reload).toHaveBeenCalledOnce()
  })

  it('sends nothing before consent and closes consent while jobs start', async () => {
    const store = useMagicPatchBatchStore()
    store.offer([first, second, first])
    expect(store.candidates).toHaveLength(2)
    expect(api.fetchApi).not.toHaveBeenCalled()
    const confirmation = store.confirm()
    expect(store.consentOpen).toBe(false)
    await confirmation
    await settleCompletion(store)
  })

  it('pins both genuinely associated native revisions and reloads once after acknowledgement', async () => {
    const store = await submit([first, second])
    expect(store.acknowledged).toBe(true)
    expect(store.visible).toBe(false)
    expect(mocks.pin).toHaveBeenCalledTimes(2)
    expect(mocks.pin).toHaveBeenCalledWith(releases[0], true, false)
    expect(app.reloadNodeDefs).toHaveBeenCalled()
    expect(mocks.reload).toHaveBeenCalledTimes(1)
    await store.refresh()
    expect(await store.acknowledge()).toBe(false)
    expect(mocks.reload).toHaveBeenCalledTimes(1)
  })

  it('accepts a verified report without equating its native revision to a release identifier', async () => {
    includeRelease = false
    const store = await submit()
    const job = store.jobs[0]
    if (!job || job.state.phase !== 'active')
      throw new Error('ready fixture was not admitted')
    expect(job.state.request).not.toHaveProperty('release_id')
    expect(job.state.request.report_sha256).toBe(digests[0])
    expect(store.acknowledged).toBe(true)
    expect(mocks.pin).toHaveBeenCalledWith(releases[0], true, false)
    expect(mocks.reload).toHaveBeenCalledTimes(1)
  })

  it('keeps ready requests pending without a valid report digest even when a release identifier exists', async () => {
    states[0] = 'waiting_install'
    const store = await submit()
    for (const digest of [
      undefined,
      '',
      'a'.repeat(63),
      'g'.repeat(64),
      'A'.repeat(64)
    ]) {
      store.jobs = store.jobs.map(
        (job): PackConversion => ({
          ...job,
          state: {
            phase: 'active',
            disconnected: false,
            request: { ...status(0), state: 'ready', report_sha256: digest }
          }
        })
      )
      await nextTick()
      expect(store.ready).toBe(false)
      expect(store.acknowledged).toBe(false)
      expect(mocks.load).not.toHaveBeenCalled()
      expect(mocks.pin).not.toHaveBeenCalled()
      expect(mocks.reload).not.toHaveBeenCalled()
    }
  })

  it('completed operation with waiting_install never grants reload permission', async () => {
    states[1] = 'waiting_install'
    const store = await submit([first, second])
    expect(store.ready).toBe(false)
    expect(mocks.reload).not.toHaveBeenCalled()
    states[1] = 'ready'
    await store.refresh()
    await settleCompletion(store)
    expect(await store.acknowledge()).toBe(true)
    expect(mocks.reload).toHaveBeenCalledTimes(1)
  })

  it('continues tracking independently after switching graphs without reloading the new one', async () => {
    states[0] = 'waiting_install'
    const store = await submit()
    mocks.document = {}
    mocks.documentId = 'document-b'
    states[0] = 'ready'
    await store.refresh()
    await settleCompletion(store)
    expect(store.ready).toBe(true)
    expect(store.jobs).toHaveLength(1)
    expect(await store.acknowledge()).toBe(false)
    expect(store.completionReason).toBe('workflow_changed')
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('refuses a new load even when the active workflow object is reused', async () => {
    states[0] = 'waiting_install'
    const store = await submit()
    mocks.documentId = 'new-load-of-same-file'
    states[0] = 'ready'
    await store.refresh()
    await settleCompletion(store)
    expect(await store.acknowledge()).toBe(false)
    expect(store.completionReason).toBe('workflow_changed')
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('refuses a closed affected workflow', async () => {
    states[0] = 'waiting_install'
    const store = await submit()
    mocks.document = null
    mocks.documentId = undefined
    states[0] = 'ready'
    await store.refresh()
    await settleCompletion(store)
    expect(await store.acknowledge()).toBe(false)
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('fences delayed completion when account scope changes away and back', async () => {
    let release: (() => void) | undefined
    mocks.load.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = () => resolve(true)
        })
    )
    const store = useMagicPatchBatchStore()
    store.offer([first])
    await store.confirm()
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledOnce())
    scope.value = 'other-owner'
    scope.value = 'owner'
    release?.()
    await nextTick()
    expect(store.jobs).toHaveLength(0)
    expect(store.visible).toBe(false)
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('rejects report bytes that disagree with the ready status SHA', async () => {
    reports[0] = JSON.stringify({ publication_association: {} })
    const store = await submit()
    expect(store.completionReason).toBe('publication_report_unverified')
    expect(mocks.pin).not.toHaveBeenCalled()
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('holds a verified report without a persisted source-to-publication relation', async () => {
    reports[0] = '{}'
    digests[0] = createHash('sha256').update(reports[0]).digest('hex')
    const store = await submit()
    expect(store.completionReason).toBe('publication_association_unavailable')
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('offers reload when a later ready status supplies the actual persisted report', async () => {
    const digest = digests[0]
    digests[0] = undefined
    const store = await submit()
    expect(store.ready).toBe(false)
    expect(store.completionReason).toBeUndefined()
    expect(mocks.reload).not.toHaveBeenCalled()
    digests[0] = digest
    statusVersion++
    await store.refresh()
    await settleCompletion(store)
    expect(store.ready).toBe(true)
    expect(mocks.reload).not.toHaveBeenCalled()
    expect(await store.acknowledge()).toBe(true)
    expect(store.acknowledged).toBe(true)
    expect(mocks.reload).toHaveBeenCalledTimes(1)
  })

  it('rejects a mapped native row outside the authenticated owner', async () => {
    catalog.value.revisions[0] = {
      ...catalog.value.revisions[0]!,
      account_owned: false
    }
    const store = await submit()
    expect(store.completionReason).toBe('release_unavailable')
    expect(mocks.pin).not.toHaveBeenCalled()
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('requires native object_info definitions for the actual mapped revision', async () => {
    mocks.definitions[nativeNames[0]!]!.comfy_cloud_revision_id = '8'.repeat(64)
    const store = await submit()
    expect(store.completionReason).toBe('definitions_unavailable')
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('keeps completion pending when graph load fails but preserves unrelated missing errors after a successful reload', async () => {
    mocks.reload.mockResolvedValue(false)
    const store = await submit()
    expect(store.acknowledged).toBe(false)
    expect(store.completionReason).toBe('reload_failed')
    mocks.reload.mockResolvedValue(true)
    mocks.missing = ['UnresolvedNode']
    expect(await store.acknowledge()).toBe(true)
    expect(store.acknowledged).toBe(true)
    expect(mocks.missing).toEqual(['UnresolvedNode'])
  })
})
