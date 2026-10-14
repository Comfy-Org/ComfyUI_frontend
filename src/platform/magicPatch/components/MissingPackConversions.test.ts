import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import type {
  RequestStatus,
  SourceAcquisition
} from '@comfyorg/magic-patch-types'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import en from '@/locales/en/main.json'
import type {
  PackConversion,
  WorkflowSourceJob
} from '../stores/magicPatchBatchStore'
import MissingPackConversions from './MissingPackConversions.vue'

const revision: CloudNodeRegistryRevision = {
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
const secondRevision: CloudNodeRegistryRevision = {
  ...revision,
  revision_id: '9'.repeat(64),
  upstream_commit: '8'.repeat(40)
}
const request = (): RequestStatus => ({
  id: '1'.repeat(32),
  operation_id: '2'.repeat(32),
  state: 'waiting_conversion',
  operation_status: 'running',
  status_version: 2,
  stage: 'conversion',
  estimated_seconds_remaining: 42
})
const job = (): PackConversion => ({
  revision,
  state: { phase: 'active', request: request(), disconnected: false }
})
interface TestNode {
  id: number
  type: string
  properties: Record<string, unknown>
  last_serialization?: { type: string }
  isSubgraphNode: () => boolean
  subgraph?: TestGraph
}
interface TestGraph {
  nodes: TestNode[]
  getNodeById: (id: string | number) => TestNode | null
}
function makeNode(
  id: number,
  version: string | undefined = revision.upstream_commit,
  type = 'RandomNumber'
): TestNode {
  return {
    id,
    type,
    properties: {
      cnr_id: 'randomnumbers',
      ...(version ? { ver: version } : {})
    },
    isSubgraphNode: () => false
  }
}
function makeGraph(nodes: TestNode[]): TestGraph {
  return {
    nodes,
    getNodeById: (id) =>
      nodes.find((node) => String(node.id) === String(id)) ?? null
  }
}
function rootAndNestedGraph(version = secondRevision.upstream_commit) {
  return makeGraph([
    makeNode(7),
    {
      ...makeNode(5, revision.upstream_commit, 'Subgraph'),
      isSubgraphNode: () => true,
      subgraph: makeGraph([makeNode(7, version)])
    }
  ])
}
const graph = ref(makeGraph([makeNode(7)]))
const graphReady = ref(true)
vi.mock('@/scripts/app', () => ({
  app: {
    get isGraphReady() {
      return graphReady.value
    },
    get rootGraph() {
      return graph.value
    }
  }
}))
const store = reactive({
  visible: true,
  jobs: [job()],
  sourceJobs: [] as WorkflowSourceJob[],
  installedRevisionIds: [] as string[],
  verifying: false,
  actionFailed: false,
  offer: vi.fn()
})
const registry = {
  catalog: ref({ revisions: [revision] }),
  state: ref({ phase: 'ready' }),
  load: vi.fn(async () => true)
}
const showRegistry = vi.fn()
vi.mock('../stores/magicPatchBatchStore', () => ({
  useMagicPatchBatchStore: () => store
}))
vi.mock('@/platform/customNodes/composables/useCloudNodeRegistry', () => ({
  useCloudNodeRegistry: () => registry
}))
vi.mock('@/platform/community/composables/useCommunityDialog', () => ({
  useCommunityDialog: () => ({ show: showRegistry })
}))
function missingGroup(
  nodeTypes: MissingPackGroup['nodeTypes']
): MissingPackGroup {
  return { packId: 'randomnumbers', nodeTypes, isResolving: false }
}
function mount(groups = [missingGroup(['RandomNumber'])]) {
  return render(MissingPackConversions, {
    props: { groups },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}
beforeEach(() => {
  store.visible = true
  store.jobs = [job()]
  store.sourceJobs = []
  store.installedRevisionIds = []
  store.verifying = false
  store.actionFailed = false
  store.offer.mockClear()
  showRegistry.mockClear()
  registry.catalog.value = { revisions: [revision] }
  graphReady.value = true
  graph.value = makeGraph([makeNode(7)])
})
describe('Problems panel conversion progress', () => {
  it.for(['f'.repeat(40), 'e'.repeat(64)])(
    'does not offer a source that conflicts with the saved version %s',
    (version) => {
      store.visible = false
      graph.value = makeGraph([makeNode(7, version)])
      mount()
      expect(
        screen.queryByRole('button', { name: en.magicPatch.reviewPacks })
      ).not.toBeInTheDocument()
      expect(store.offer).not.toHaveBeenCalled()
    }
  )
  it('reviews the matching original only after an explicit click', async () => {
    const user = userEvent.setup()
    store.visible = false
    mount()
    expect(store.offer).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: en.magicPatch.reviewPacks })
    )
    expect(store.offer).toHaveBeenCalledExactlyOnceWith([revision])
  })
  it.for([secondRevision.upstream_commit, secondRevision.revision_id])(
    'resolves nested 5:7 to its exact source stamp %s rather than root 7',
    async (version) => {
      const user = userEvent.setup()
      store.visible = false
      registry.catalog.value = { revisions: [revision, secondRevision] }
      graph.value = rootAndNestedGraph(version)
      mount([missingGroup([{ type: 'RandomNumber', nodeId: '5:7' }])])
      expect(store.offer).not.toHaveBeenCalled()
      await user.click(
        screen.getByRole('button', { name: en.magicPatch.reviewPacks })
      )
      expect(store.offer).toHaveBeenCalledExactlyOnceWith([secondRevision])
    }
  )
  it('keeps root 7 and nested 5:7 as two separately stamped revisions', async () => {
    const user = userEvent.setup()
    store.visible = false
    registry.catalog.value = { revisions: [revision, secondRevision] }
    graph.value = rootAndNestedGraph()
    mount([
      missingGroup([
        { type: 'RandomNumber', nodeId: 7 },
        { type: 'RandomNumber', nodeId: '5:7' }
      ])
    ])
    await user.click(
      screen.getByRole('button', { name: en.magicPatch.reviewPacks })
    )
    expect(store.offer).toHaveBeenCalledExactlyOnceWith([
      revision,
      secondRevision
    ])
  })
  it.for(['5:8', '9:7', '5::7'])(
    'does not fall back to a same-type node for unmatched execution ID %s',
    (nodeId) => {
      store.visible = false
      graph.value = rootAndNestedGraph(revision.upstream_commit)
      mount([missingGroup([{ type: 'RandomNumber', nodeId }])])
      expect(
        screen.queryByRole('button', { name: en.magicPatch.reviewPacks })
      ).not.toBeInTheDocument()
      expect(store.offer).not.toHaveBeenCalled()
    }
  )
  it('does not replace a conflicting root stamp with the nested match', () => {
    store.visible = false
    graph.value = makeGraph([
      makeNode(7, 'f'.repeat(40)),
      {
        ...makeNode(5, revision.upstream_commit, 'Subgraph'),
        isSubgraphNode: () => true,
        subgraph: makeGraph([makeNode(7)])
      }
    ])
    mount([missingGroup([{ type: 'RandomNumber', nodeId: 7 }])])
    expect(
      screen.queryByRole('button', { name: en.magicPatch.reviewPacks })
    ).not.toBeInTheDocument()
    expect(store.offer).not.toHaveBeenCalled()
  })
  it('preserves the original type of an unregistered live node', async () => {
    const user = userEvent.setup()
    store.visible = false
    graph.value = makeGraph([
      {
        ...makeNode(7, revision.upstream_commit, 'Unregistered'),
        last_serialization: { type: 'RandomNumber' }
      }
    ])
    mount([missingGroup([{ type: 'RandomNumber', nodeId: 7 }])])
    await user.click(
      screen.getByRole('button', { name: en.magicPatch.reviewPacks })
    )
    expect(store.offer).toHaveBeenCalledExactlyOnceWith([revision])
  })
  it.for(['ambiguous', 'unknown', 'already-v2'])(
    'opens Node Registry without offering conversion for %s discovery',
    async (scenario) => {
      const user = userEvent.setup()
      store.visible = false
      if (scenario === 'ambiguous') {
        const unstamped = makeNode(7)
        unstamped.properties = { cnr_id: 'randomnumbers' }
        graph.value = makeGraph([unstamped])
        registry.catalog.value = { revisions: [revision, secondRevision] }
      } else if (scenario === 'already-v2') {
        registry.catalog.value = {
          revisions: [{ ...revision, node_api_version: 2, prepared: true }]
        }
      } else {
        graph.value = makeGraph([
          makeNode(7, revision.upstream_commit, 'UnknownNode')
        ])
      }
      mount([
        missingGroup([
          {
            type: scenario === 'unknown' ? 'UnknownNode' : 'RandomNumber',
            nodeId: 7
          }
        ])
      ])
      expect(
        screen.queryByRole('button', { name: en.magicPatch.reviewPacks })
      ).not.toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: en.magicPatch.openRegistry })
      )
      expect(showRegistry).toHaveBeenCalledExactlyOnceWith('packs')
      expect(store.offer).not.toHaveBeenCalled()
    }
  )
  it('shows the backend already-V2 reason and routes to Registry without resubmitting', async () => {
    const user = userEvent.setup()
    store.jobs = [
      { revision, state: { phase: 'error', reason: 'source_already_v2' } }
    ]
    mount([])
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.reasons.source_already_v2
    )
    await user.click(
      screen.getByRole('button', { name: en.magicPatch.openRegistry })
    )
    expect(showRegistry).toHaveBeenCalledExactlyOnceWith('packs')
    expect(store.offer).not.toHaveBeenCalled()
  })
  it('shows source preparation even when the missing-node groups have disappeared', async () => {
    const acquisition: SourceAcquisition = {
      acquisition_id: 'c'.repeat(32),
      state: 'queued',
      status_version: 1,
      source_ref: null,
      reason: null,
      conversion_supported: false,
      message: 'Queued',
      progress: {
        stage: 'source_preparation',
        state: 'queued',
        message: 'Queued'
      }
    }
    store.jobs = [
      {
        revision,
        state: {
          phase: 'preparing',
          selector: {
            pack_id: revision.pack_id,
            revision_id: revision.revision_id
          },
          acquisition,
          deadline: performance.now() + 600_000,
          disconnected: false
        }
      }
    ]
    const view = mount()
    await view.rerender({ groups: [] })
    expect(screen.getByText(en.magicPatch.preparation.queued)).toBeVisible()
    store.jobs = [
      {
        revision,
        state: {
          phase: 'preparing',
          selector: {
            pack_id: revision.pack_id,
            revision_id: revision.revision_id
          },
          acquisition: {
            ...acquisition,
            state: 'acquiring',
            status_version: 2
          },
          deadline: performance.now() + 600_000,
          disconnected: false
        }
      }
    ]
    await nextTick()
    expect(screen.getByText(en.magicPatch.preparation.acquiring)).toBeVisible()
  })
  it('updates the named pack and stage as conversion advances', async () => {
    mount()
    const progress = screen.getByRole('status', {
      name: en.magicPatch.progressTitle
    })
    expect(within(progress).getByText('RandomNumbers')).toBeVisible()
    expect(
      within(progress).getByText(en.magicPatch.stages.conversion)
    ).toBeVisible()
    expect(progress).toHaveTextContent('42')
    const bar = screen.getByRole('progressbar', {
      name: 'Conversion progress for RandomNumbers'
    })
    expect(bar).toBeVisible()
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '8')
    store.jobs = [
      {
        revision,
        state: {
          phase: 'active',
          disconnected: false,
          request: { ...request(), stage: 'qualification', status_version: 3 }
        }
      }
    ]
    await nextTick()
    expect(
      within(progress).getByText(en.magicPatch.stages.qualification)
    ).toBeVisible()
    expect(bar).toHaveAttribute('aria-valuenow', '4')
    expect(
      within(progress).queryByText(en.magicPatch.stages.conversion)
    ).toBeNull()
  })
  it('shows completion only after installation verification and removes progress after acknowledgement', async () => {
    mount()
    store.jobs = [
      {
        revision,
        state: {
          phase: 'active',
          disconnected: false,
          request: {
            ...request(),
            state: 'ready',
            operation_status: 'completed',
            stage: undefined,
            estimated_seconds_remaining: undefined
          }
        }
      }
    ]
    store.verifying = true
    await nextTick()
    expect(screen.getByText(en.magicPatch.verifyingInstallation)).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '7'
    )
    expect(screen.queryByText(en.magicPatch.states.ready)).toBeNull()
    store.verifying = false
    store.installedRevisionIds = [revision.revision_id]
    await nextTick()
    expect(screen.getByText(en.magicPatch.states.ready)).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
    store.visible = false
    await nextTick()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
  it('marks disconnected progress and source failures explicitly', async () => {
    mount()
    store.jobs = [
      {
        revision,
        state: { phase: 'active', request: request(), disconnected: true }
      }
    ]
    await nextTick()
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.disconnected
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
    store.jobs = [{ revision, state: { phase: 'error' } }]
    await nextTick()
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.unavailable
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
  it('shows a labelled estimate from elapsed time and backend remaining time', () => {
    const active = job()
    active.observedAt = Date.now() - 10_000
    if (active.state.phase !== 'active')
      throw new Error('Active fixture required')
    active.state.request.estimated_seconds_remaining = 30
    store.jobs = [active]
    mount()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '25'
    )
    expect(screen.getByText('Estimated progress: 25%')).toBeVisible()
  })
  it.for(['failed', 'withdrawn'] as const)(
    'does not animate a %s conversion',
    async (state) => {
      mount()
      store.jobs = [
        {
          revision,
          state: {
            phase: 'active',
            request: { ...request(), state },
            disconnected: false
          }
        }
      ]
      await nextTick()
      expect(screen.queryByRole('progressbar')).toBeNull()
      expect(screen.getByText(en.magicPatch.states[state])).toBeVisible()
    }
  )
})
