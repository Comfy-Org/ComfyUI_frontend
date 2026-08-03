import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type * as VueRouter from 'vue-router'

import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

const ids = vi.hoisted(() => ({
  root: '00000000-0000-4000-8000-000000000000',
  validSubgraph: '11111111-1111-4111-8111-111111111111',
  deletedSubgraph: '22222222-2222-4222-8222-222222222222'
}))

const workflowStoreState = vi.hoisted(() => ({
  openWorkflows: [] as unknown[],
  activeSubgraph: undefined as unknown
}))

const routerMocks = vi.hoisted(() => ({
  push: vi.fn().mockResolvedValue(undefined),
  replace: vi.fn().mockResolvedValue(undefined)
}))

const routeHashRef = ref('')

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRouter>()
  return {
    ...actual,
    useRouter: () => routerMocks
  }
})

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

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => workflowStoreState
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
    app.rootGraph.id = ids.root
    app.rootGraph.subgraphs.clear()
    app.canvas.subgraph = undefined
    app.canvas.graph = app.rootGraph
    workflowStoreState.openWorkflows = []
    workflowStoreState.activeSubgraph = undefined
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

  it('redirects to root when hash references a deleted subgraph', async () => {
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
    )
  })

  it('redirects to root when hash is malformed (not a UUID)', async () => {
    useSubgraphNavigationStore()

    routeHashRef.value = '#not-a-valid-uuid'
    await vi.waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
    )
    expect(app.canvas.setGraph).not.toHaveBeenCalled()
  })

  it('does not redirect when hash equals a non-UUID root graph id (loaded workflow slug)', async () => {
    const slugRootId = 'test-missing-models-in-subgraph'
    app.rootGraph.id = slugRootId
    app.canvas.graph = fromPartial<LGraph>({ id: slugRootId })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${slugRootId}`
    await flushHashWatcher()

    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(app.canvas.setGraph).not.toHaveBeenCalled()
  })

  it('redirects when hash is a non-UUID slug that does not match root', async () => {
    useSubgraphNavigationStore()

    routeHashRef.value = '#some-other-slug'
    await vi.waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
    )
  })

  it('does not redirect or re-set graph when hash equals current root graph', async () => {
    app.canvas.graph = fromPartial<LGraph>({ id: ids.root })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.root}`
    await flushHashWatcher()

    expect(app.canvas.setGraph).not.toHaveBeenCalled()
    expect(routerMocks.replace).not.toHaveBeenCalled()
  })

  it('does not redirect when transitioning to an empty hash on the root graph', async () => {
    routeHashRef.value = `#${ids.root}`
    app.canvas.graph = fromPartial<LGraph>({ id: ids.root })
    useSubgraphNavigationStore()
    await flushHashWatcher()
    routerMocks.replace.mockClear()
    vi.mocked(app.canvas.setGraph).mockClear()

    routeHashRef.value = ''
    await flushHashWatcher()

    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(app.canvas.setGraph).not.toHaveBeenCalled()
  })

  it('redirects when canvas still references a deleted subgraph (stale-graph guard)', async () => {
    app.canvas.graph = makeSubgraph(ids.deletedSubgraph)
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
      expect(app.canvas.setGraph).toHaveBeenCalledWith(app.rootGraph)
    })
  })

  it('recovers canvas to root even if router.replace rejects', async () => {
    routerMocks.replace.mockRejectedValueOnce(new Error('navigation aborted'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    app.canvas.graph = makeSubgraph(ids.deletedSubgraph)
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() =>
      expect(app.canvas.setGraph).toHaveBeenCalledWith(app.rootGraph)
    )
    warnSpy.mockRestore()
  })

  it('redirects when a workflow load resolves but the subgraph is still missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    workflowStoreState.openWorkflows = [
      fromPartial<ComfyWorkflow>({
        path: 'phantom-workflow.json',
        activeState: {
          id: ids.deletedSubgraph,
          definitions: { subgraphs: [] }
        }
      })
    ]
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() => {
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalled()
      expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('subgraph not found after workflow load')
      )
    })
    warnSpy.mockRestore()
  })

  it('redirects when openWorkflow rejects during recovery', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    workflowServiceMocks.openWorkflow.mockRejectedValueOnce(
      new Error('load failed')
    )
    workflowStoreState.openWorkflows = [
      fromPartial<ComfyWorkflow>({
        path: 'broken-workflow.json',
        activeState: {
          id: ids.deletedSubgraph,
          definitions: { subgraphs: [] }
        }
      })
    ]
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('workflow load failed')
      )
    })
    warnSpy.mockRestore()
  })

  it('routeHash watcher does not re-enter navigateToHash during recovery redirect', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Simulate the real router replace: trigger the routeHash watcher
    // exactly the way vue-router does when the URL is replaced.
    routerMocks.replace.mockImplementation((target) => {
      const hash = typeof target === 'string' ? target : ''
      routeHashRef.value = hash
      return Promise.resolve(undefined)
    })
    app.canvas.graph = makeSubgraph(ids.deletedSubgraph)
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith(`#${app.rootGraph.id}`)
    })

    // navigateToHash for the deleted id ran once and produced exactly one
    // redirect. The watcher must NOT have fired again for the rewritten
    // (root) hash and produced a second redirect.
    expect(routerMocks.replace).toHaveBeenCalledTimes(1)
    expect(app.canvas.setGraph).toHaveBeenCalledWith(app.rootGraph)
    warnSpy.mockRestore()
  })
})
