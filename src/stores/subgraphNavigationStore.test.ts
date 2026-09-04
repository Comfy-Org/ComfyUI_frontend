import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type * as VueRouter from 'vue-router'

import type { Subgraph } from '@/lib/litegraph/src/LGraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

type MockSubgraph = Pick<Subgraph, 'id' | 'rootGraph' | '_nodes' | 'nodes'>

const {
  routeHash,
  routerPush,
  routerReplace,
  routerHistory,
  mockOpenWorkflow
} = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    routeHash: ref(''),
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
    routerHistory: { state: {} },
    mockOpenWorkflow: vi.fn()
  }
})

function createMockSubgraph(id: string, rootGraph = app.rootGraph): Subgraph {
  const mockSubgraph = {
    id,
    rootGraph,
    _nodes: [],
    nodes: []
  } satisfies MockSubgraph

  return fromPartial<Subgraph>(mockSubgraph)
}

function getRouteTargetHash(target: VueRouter.RouteLocationRaw): string {
  return typeof target === 'string' ? target : String(target.hash ?? '')
}

function applyRouteTarget(target: VueRouter.RouteLocationRaw): void {
  routerHistory.state = typeof target === 'string' ? {} : (target.state ?? {})
  routeHash.value = getRouteTargetHash(target)
}

vi.mock('@/scripts/app', () => {
  const mockCanvas = {
    graph: null,
    subgraph: null,
    ds: {
      scale: 1,
      offset: [0, 0],
      state: {
        scale: 1,
        offset: [0, 0]
      }
    },
    setDirty: vi.fn(),
    setGraph: vi.fn()
  }

  const mockGraph = {
    _nodes: [],
    nodes: [],
    subgraphs: new Map(),
    getNodeById: vi.fn()
  }

  return {
    app: {
      graph: mockGraph,
      rootGraph: mockGraph,
      canvas: mockCanvas
    }
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => app.canvas
  })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  findSubgraphPathById: vi.fn()
}))
vi.mock('@vueuse/router', () => ({ useRouteHash: () => routeHash }))
vi.mock('vue-router', () => ({
  NavigationFailureType: { cancelled: 8, duplicated: 16 },
  isNavigationFailure: vi.fn(() => false),
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    options: { history: routerHistory }
  })
}))
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ openWorkflow: mockOpenWorkflow })
}))

describe('useSubgraphNavigationStore', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    app.rootGraph.subgraphs.clear()
    app.rootGraph.id = 'current-root'
    app.canvas.graph = app.rootGraph
    app.canvas.subgraph = undefined
    app.canvas.ds.scale = 1
    app.canvas.ds.offset = [0, 0]
    app.canvas.ds.state.scale = 1
    app.canvas.ds.state.offset = [0, 0]
    app.graph.getNodeById = vi.fn()
    routeHash.value = ''
    routerHistory.state = {}
    routerPush.mockReset().mockImplementation(async (target) => {
      applyRouteTarget(target)
    })
    routerReplace.mockReset().mockImplementation(async (target) => {
      applyRouteTarget(target)
    })
    mockOpenWorkflow.mockReset()
  })

  afterEach(() => disposePinia(pinia))

  it('should not clear navigation stack when workflow internal state changes', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()

    // Mock a workflow
    const mockWorkflow = fromPartial<ComfyWorkflow>({
      path: 'test-workflow.json',
      filename: 'test-workflow.json',
      changeTracker: null
    })

    // Set the active workflow (cast to bypass TypeScript check in test)
    workflowStore.activeWorkflow =
      mockWorkflow as typeof workflowStore.activeWorkflow

    // Simulate being in a subgraph by restoring state
    navigationStore.restoreState(['subgraph-1', 'subgraph-2'])

    expect(navigationStore.exportState()).toHaveLength(2)

    // Simulate a change to the workflow's internal state
    // (e.g., changeTracker.activeState being reassigned)
    mockWorkflow.changeTracker = {
      activeState: {}
    } as typeof mockWorkflow.changeTracker

    // The navigation stack should NOT be cleared because the path hasn't changed
    expect(navigationStore.exportState()).toHaveLength(2)
    expect(navigationStore.exportState()).toEqual(['subgraph-1', 'subgraph-2'])
  })

  it('should preserve navigation stack per workflow', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()
    const { findSubgraphPathById } = await import('@/utils/graphTraversalUtil')

    const workflow1 = fromPartial<ComfyWorkflow>({
      path: 'workflow1.json',
      filename: 'workflow1.json'
    })

    const workflow2 = fromPartial<ComfyWorkflow>({
      path: 'workflow2.json',
      filename: 'workflow2.json'
    })

    const sub1 = createMockSubgraph('sub-1')
    const sub2 = createMockSubgraph('sub-2')

    app.rootGraph.subgraphs.set(sub1.id, sub1)
    app.rootGraph.subgraphs.set(sub2.id, sub2)

    vi.mocked(findSubgraphPathById).mockImplementation((_rootGraph, id) => {
      if (id === sub1.id) return [sub1.id]
      if (id === sub2.id) return [sub1.id, sub2.id]
      return null
    })

    // Workflow1 is in a nested subgraph (sub-1 -> sub-2)
    app.canvas.subgraph = sub2
    workflowStore.activeWorkflow =
      workflow1 as typeof workflowStore.activeWorkflow
    await nextTick()

    expect(navigationStore.exportState()).toEqual([sub1.id, sub2.id])

    // Switch to workflow2 at root level
    app.canvas.subgraph = undefined
    workflowStore.activeWorkflow =
      workflow2 as typeof workflowStore.activeWorkflow
    await nextTick()

    expect(navigationStore.exportState()).toEqual([])

    // Switch back to workflow1 in its subgraph
    app.canvas.subgraph = sub2
    workflowStore.activeWorkflow =
      workflow1 as typeof workflowStore.activeWorkflow
    await nextTick()

    expect(navigationStore.exportState()).toEqual([sub1.id, sub2.id])
  })

  it('should reset navigation on workflow switch and restore on switch back', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()
    const { findSubgraphPathById } = await import('@/utils/graphTraversalUtil')

    const workflow1 = fromPartial<ComfyWorkflow>({
      path: 'workflow1.json',
      filename: 'workflow1.json'
    })

    const workflow1Subgraph = createMockSubgraph('sub-1')

    app.rootGraph.subgraphs.set(workflow1Subgraph.id, workflow1Subgraph)
    vi.mocked(findSubgraphPathById).mockImplementation((_rootGraph, id) =>
      id === workflow1Subgraph.id ? [workflow1Subgraph.id] : null
    )

    app.canvas.subgraph = workflow1Subgraph

    workflowStore.activeWorkflow =
      workflow1 as typeof workflowStore.activeWorkflow
    await nextTick()

    expect(navigationStore.exportState()).toEqual([workflow1Subgraph.id])

    const workflow2 = fromPartial<ComfyWorkflow>({
      path: 'workflow2.json',
      filename: 'workflow2.json'
    })

    app.canvas.subgraph = undefined

    workflowStore.activeWorkflow =
      workflow2 as typeof workflowStore.activeWorkflow
    await nextTick()

    expect(navigationStore.exportState()).toEqual([])

    app.canvas.subgraph = workflow1Subgraph

    workflowStore.activeWorkflow =
      workflow1 as typeof workflowStore.activeWorkflow
    await nextTick()

    expect(navigationStore.exportState()).toEqual([workflow1Subgraph.id])
  })

  it('should handle restoreState with unreachable subgraph IDs', () => {
    const navigationStore = useSubgraphNavigationStore()

    navigationStore.restoreState(['nonexistent-sub'])

    expect(navigationStore.exportState()).toEqual(['nonexistent-sub'])
    expect(navigationStore.navigationStack).toEqual([])
  })

  it('should fall back to the active subgraph id when path lookup fails during navigation updates', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()
    const { findSubgraphPathById } = await import('@/utils/graphTraversalUtil')

    const unreachableSubgraph = createMockSubgraph('orphan-subgraph', app.graph)

    app.graph.subgraphs.set(unreachableSubgraph.id, unreachableSubgraph)
    vi.mocked(findSubgraphPathById).mockReturnValue(null)

    const mockWorkflow = fromPartial<ComfyWorkflow>({
      path: 'test-workflow.json',
      filename: 'test-workflow.json'
    })

    workflowStore.activeWorkflow =
      mockWorkflow as typeof workflowStore.activeWorkflow

    app.canvas.subgraph = unreachableSubgraph
    workflowStore.updateActiveGraph()
    await nextTick()

    expect(navigationStore.exportState()).toEqual([unreachableSubgraph.id])
    expect(navigationStore.navigationStack).toEqual([unreachableSubgraph])
  })

  it('should clear navigation when activeSubgraph becomes undefined', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()
    const { findSubgraphPathById } = await import('@/utils/graphTraversalUtil')

    // Create mock subgraph and graph structure
    const mockSubgraph = createMockSubgraph('subgraph-1', app.graph)

    // Add the subgraph to the graph's subgraphs map
    app.graph.subgraphs.set('subgraph-1', mockSubgraph)

    // First set an active workflow
    const mockWorkflow = fromPartial<ComfyWorkflow>({
      path: 'test-workflow.json',
      filename: 'test-workflow.json'
    })

    workflowStore.activeWorkflow =
      mockWorkflow as typeof workflowStore.activeWorkflow

    // Mock findSubgraphPathById to return the correct path
    vi.mocked(findSubgraphPathById).mockReturnValue(['subgraph-1'])

    // Set canvas.subgraph and trigger update to set activeSubgraph
    app.canvas.subgraph = mockSubgraph
    workflowStore.updateActiveGraph()

    // Wait for Vue's reactivity to process the change
    await nextTick()

    // Verify navigation was set by the watcher
    expect(navigationStore.exportState()).toHaveLength(1)
    expect(navigationStore.exportState()).toEqual(['subgraph-1'])

    // Clear canvas.subgraph and trigger update (simulating navigating back to root)
    app.canvas.subgraph = undefined
    workflowStore.updateActiveGraph()

    // Wait for Vue's reactivity to process the change
    await nextTick()

    // Stack should be cleared when activeSubgraph becomes undefined
    expect(navigationStore.exportState()).toHaveLength(0)
  })

  it('does not reopen workflows for hashes written during graph changes', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()
    const nextGraph = fromPartial<typeof app.rootGraph>({ id: 'next-root' })
    const nextWorkflow = fromPartial<ComfyWorkflow>({
      path: 'next-workflow.json',
      filename: 'next-workflow.json',
      activeState: { id: 'next-root' }
    })
    workflowStore.attachWorkflow(nextWorkflow, 0)

    await navigationStore.updateHash()
    app.canvas.graph = nextGraph
    await navigationStore.updateHash()
    await nextTick()

    expect(routerReplace).toHaveBeenCalledWith(
      expect.objectContaining({ hash: '#current-root' })
    )
    expect(routerPush).toHaveBeenCalledWith(
      expect.objectContaining({ hash: '#next-root' })
    )
    expect(mockOpenWorkflow).not.toHaveBeenCalled()
  })

  it('writes the latest graph after an earlier route write settles', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const firstId = '11111111-1111-4111-8111-111111111111'
    const secondId = '22222222-2222-4222-8222-222222222222'
    const firstGraph = createMockSubgraph(firstId)
    const secondGraph = createMockSubgraph(secondId)
    let resolveFirstPush: (() => void) | undefined

    app.rootGraph.subgraphs.set(firstId, firstGraph)
    app.rootGraph.subgraphs.set(secondId, secondGraph)

    routerPush
      .mockImplementationOnce((target) => {
        applyRouteTarget(target)
        return new Promise<void>((resolve) => {
          resolveFirstPush = resolve
        })
      })
      .mockImplementationOnce(async (target) => {
        applyRouteTarget(target)
      })

    await navigationStore.updateHash()
    app.canvas.graph = firstGraph
    const firstUpdate = navigationStore.updateHash()
    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        expect.objectContaining({ hash: '#' + firstId })
      )
    })

    app.canvas.graph = secondGraph
    const secondUpdate = navigationStore.updateHash()
    expect(routerPush).toHaveBeenCalledTimes(1)

    resolveFirstPush?.()
    await Promise.all([firstUpdate, secondUpdate])

    expect(
      routerPush.mock.calls.map(([target]) => getRouteTargetHash(target))
    ).toEqual(['#' + firstId, '#' + secondId])
    expect(routeHash.value).toBe('#' + secondId)
    expect(mockOpenWorkflow).not.toHaveBeenCalled()
  })

  it('handles an external route while an internal write is pending', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const nextGraph = fromPartial<typeof app.rootGraph>({ id: 'next-root' })
    const externalId = '33333333-3333-4333-8333-333333333333'
    const externalGraph = createMockSubgraph(externalId)
    let resolvePush: (() => void) | undefined

    app.rootGraph.subgraphs.set(externalId, externalGraph)
    routerPush.mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePush = resolve
      })
    })
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
    })

    await navigationStore.updateHash()
    app.canvas.graph = nextGraph
    const internalUpdate = navigationStore.updateHash()
    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        expect.objectContaining({ hash: '#next-root' })
      )
    })

    routerHistory.state = {}
    routeHash.value = '#' + externalId

    await vi.waitFor(() =>
      expect(app.canvas.setGraph).toHaveBeenCalledWith(externalGraph)
    )
    resolvePush?.()
    await internalUpdate
  })

  it('handles an external return to an internally written hash', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const firstId = '11111111-1111-4111-8111-111111111111'
    const secondId = '22222222-2222-4222-8222-222222222222'
    const firstGraph = createMockSubgraph(firstId)
    const secondGraph = createMockSubgraph(secondId)
    let resolvePush: (() => void) | undefined

    app.rootGraph.subgraphs.set(firstId, firstGraph)
    app.rootGraph.subgraphs.set(secondId, secondGraph)
    routerPush.mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePush = resolve
      })
    })
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
    })

    await navigationStore.updateHash()
    app.canvas.graph = firstGraph
    const internalUpdate = navigationStore.updateHash()
    await vi.waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        expect.objectContaining({ hash: '#' + firstId })
      )
    })

    routerHistory.state = {}
    routeHash.value = '#' + secondId
    await vi.waitFor(() =>
      expect(app.canvas.setGraph).toHaveBeenLastCalledWith(secondGraph)
    )
    routerHistory.state = {}
    routeHash.value = '#' + firstId

    await vi.waitFor(() =>
      expect(app.canvas.setGraph).toHaveBeenLastCalledWith(firstGraph)
    )
    expect(app.canvas.graph).toBe(firstGraph)
    expect(routeHash.value).toBe('#' + firstId)
    resolvePush?.()
    await internalUpdate
  })

  it('keeps a direct external hash that matches an older pending write', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const firstId = '11111111-1111-4111-8111-111111111111'
    const secondId = '22222222-2222-4222-8222-222222222222'
    const firstGraph = createMockSubgraph(firstId)
    const secondGraph = createMockSubgraph(secondId)
    let resolvePush: (() => void) | undefined

    app.rootGraph.subgraphs.set(firstId, firstGraph)
    app.rootGraph.subgraphs.set(secondId, secondGraph)
    routerPush.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePush = resolve
        })
    )
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
    })

    await navigationStore.updateHash()
    app.canvas.graph = firstGraph
    const firstUpdate = navigationStore.updateHash()
    await vi.waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(
        expect.objectContaining({ hash: '#' + firstId })
      )
    )

    app.canvas.graph = secondGraph
    const secondUpdate = navigationStore.updateHash()
    routerHistory.state = {}
    routeHash.value = '#' + firstId

    await vi.waitFor(() => expect(app.canvas.graph).toBe(firstGraph))
    resolvePush?.()
    await Promise.all([firstUpdate, secondUpdate])

    expect(routeHash.value).toBe('#' + firstId)
    expect(routerPush).toHaveBeenCalledTimes(1)
  })
})
