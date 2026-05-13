import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

const ids = vi.hoisted(() => ({
  root: '00000000-0000-4000-8000-000000000000',
  validSubgraph: '11111111-1111-4111-8111-111111111111',
  deletedSubgraph: '22222222-2222-4222-8222-222222222222'
}))

const routerMocks = vi.hoisted(() => ({
  push: vi.fn().mockResolvedValue(undefined),
  replace: vi.fn().mockResolvedValue(undefined)
}))

const routeHashRef = ref('')

vi.mock('vue-router', () => ({
  useRouter: () => routerMocks
}))

vi.mock('@vueuse/router', () => ({
  useRouteHash: () => routeHashRef
}))

vi.mock('@/scripts/app', () => {
  const mockCanvas = {
    subgraph: null,
    graph: null,
    setGraph: vi.fn(),
    setDirty: vi.fn(),
    ds: {
      scale: 1,
      offset: [0, 0],
      state: { scale: 1, offset: [0, 0] }
    }
  }

  const mockRoot = {
    id: ids.root,
    _nodes: [],
    nodes: [],
    subgraphs: new Map(),
    getNodeById: vi.fn()
  }

  return {
    app: {
      graph: mockRoot,
      rootGraph: mockRoot,
      canvas: mockCanvas
    }
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => app.canvas,
    currentGraph: null
  })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  findSubgraphPathById: vi.fn().mockReturnValue(null)
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ fitView: vi.fn() })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotElementTracking',
  () => ({ requestSlotLayoutSyncForAllNodes: vi.fn() })
)

const workflowServiceMocks = vi.hoisted(() => ({
  openWorkflow: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => workflowServiceMocks
}))

function makeSubgraph(id: string): Subgraph {
  return fromPartial<Subgraph>({
    id,
    rootGraph: app.rootGraph,
    _nodes: [],
    nodes: []
  })
}

async function flushHashWatcher() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe('useSubgraphNavigationStore - navigateToHash validation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.rootGraph.subgraphs.clear()
    app.canvas.subgraph = undefined
    app.canvas.graph = app.rootGraph
    routeHashRef.value = ''
  })

  it('navigates to a valid, existing subgraph hash', async () => {
    const subgraph = makeSubgraph(ids.validSubgraph)
    app.rootGraph.subgraphs.set(subgraph.id, subgraph)
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.validSubgraph}`
    await flushHashWatcher()

    expect(app.canvas.setGraph).toHaveBeenCalledWith(subgraph)
    expect(routerMocks.replace).not.toHaveBeenCalled()
  })

  it('redirects URL to root when hash references a deleted subgraph', async () => {
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await flushHashWatcher()

    expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
  })

  it('redirects URL to root when hash is malformed (not a UUID)', async () => {
    useSubgraphNavigationStore()

    routeHashRef.value = '#not-a-valid-uuid'
    await flushHashWatcher()

    expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
    expect(app.canvas.setGraph).not.toHaveBeenCalled()
  })

  it('does not redirect when hash is a non-UUID root graph id (e.g. workflow slug)', async () => {
    const slugRootId = 'test-missing-models-in-subgraph'
    app.rootGraph.id = slugRootId
    app.canvas.graph = fromPartial<LGraph>({ id: slugRootId })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${slugRootId}`
    await flushHashWatcher()

    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(app.canvas.setGraph).not.toHaveBeenCalled()

    app.rootGraph.id = ids.root
  })

  it('does not redirect or re-set graph when hash equals current graph', async () => {
    app.canvas.graph = fromPartial<LGraph>({ id: ids.root })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.root}`
    await flushHashWatcher()

    expect(app.canvas.setGraph).not.toHaveBeenCalled()
    expect(routerMocks.replace).not.toHaveBeenCalled()
  })

  it('redirects to root even when canvas still references a deleted subgraph (stale-graph guard)', async () => {
    const stale = makeSubgraph(ids.deletedSubgraph)
    app.canvas.graph = stale
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await flushHashWatcher()
    await flushHashWatcher()

    expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
  })

  it('treats an empty hash as the root graph (no redirect)', async () => {
    app.canvas.graph = fromPartial<LGraph>({ id: ids.root })
    useSubgraphNavigationStore()

    routeHashRef.value = ''
    await flushHashWatcher()

    expect(routerMocks.replace).not.toHaveBeenCalled()
  })

  it('redirects to root when a workflow loads but the target subgraph is still missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const workflowStore = useWorkflowStore() as unknown as {
      openWorkflows: ComfyWorkflow[]
    }
    workflowStore.openWorkflows = [
      fromPartial<ComfyWorkflow>({
        path: 'phantom-workflow.json',
        filename: 'phantom-workflow.json',
        activeState: {
          id: ids.deletedSubgraph,
          definitions: { subgraphs: [] }
        }
      })
    ]

    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await flushHashWatcher()
    await flushHashWatcher()

    expect(workflowServiceMocks.openWorkflow).toHaveBeenCalled()
    expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('subgraph not found after workflow load')
    )
    warnSpy.mockRestore()
  })
})
