import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'

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
  replace: vi.fn().mockResolvedValue(undefined),
  history: { state: {} }
}))

const routeHashRef = ref('')
const currentGraphRef = shallowRef<LGraph | null>(null)

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRouter>()
  return {
    ...actual,
    useRouter: () => ({
      ...routerMocks,
      options: { history: routerMocks.history }
    })
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
    get currentGraph() {
      return currentGraphRef.value
    }
  })
}))

const reportErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ fitView: vi.fn() })
}))

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
    isRootGraph: false,
    rootGraph: app.rootGraph,
    _nodes: [],
    nodes: []
  })
}

function getRouteTargetHash(target: VueRouter.RouteLocationRaw): string {
  return typeof target === 'string' ? target : String(target.hash ?? '')
}

function applyRouteTarget(target: VueRouter.RouteLocationRaw): void {
  routerMocks.history.state =
    typeof target === 'string' ? {} : (target.state ?? {})
  routeHashRef.value = getRouteTargetHash(target)
}

async function flushHashWatcher() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe('useSubgraphNavigationStore - navigateToHash validation', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    app.rootGraph.id = ids.root
    app.rootGraph.subgraphs.clear()
    app.canvas.subgraph = undefined
    app.canvas.graph = app.rootGraph
    currentGraphRef.value = app.rootGraph
    workflowStoreState.openWorkflows = []
    workflowStoreState.activeSubgraph = undefined
    routeHashRef.value = ''
    routerMocks.history.state = {}
    routerMocks.push.mockReset().mockImplementation(async (target) => {
      applyRouteTarget(target)
    })
    routerMocks.replace.mockReset().mockImplementation(async (target) => {
      applyRouteTarget(target)
    })
  })

  afterEach(() => disposePinia(pinia))

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
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
    )
  })

  it('redirects to root when hash is malformed (not a UUID)', async () => {
    useSubgraphNavigationStore()

    routeHashRef.value = '#not-a-valid-uuid'
    await vi.waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
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
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
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
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
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

  it('publishes a newer workflow hash after an older redirect settles', async () => {
    let resolveReplace: (() => void) | undefined
    routerMocks.replace.mockImplementation(async (target) => {
      await new Promise<void>((resolve) => {
        resolveReplace = resolve
      })
      applyRouteTarget(target)
    })
    const navigationStore = useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() => expect(routerMocks.replace).toHaveBeenCalledOnce())

    const workflowNavigationId = navigationStore.beginWorkflowNavigation()
    const newRootId = '33333333-3333-4333-8333-333333333333'
    app.rootGraph.id = newRootId
    app.canvas.graph = app.rootGraph
    currentGraphRef.value = app.rootGraph
    await navigationStore.updateHash('workflow-load', workflowNavigationId)

    resolveReplace?.()
    await vi.waitFor(() => {
      expect(routeHashRef.value).toBe(`#${newRootId}`)
      expect(routerMocks.push).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${newRootId}` })
      )
    })
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
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
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
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('workflow load failed')
      )
      expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'workflow_navigation_failure'
      })
    })
    warnSpy.mockRestore()
  })

  it('replays the latest route after a workflow-backed route load', async () => {
    const firstId = ids.deletedSubgraph
    const secondId = ids.validSubgraph
    const secondGraph = makeSubgraph(secondId)
    let resolveOpen: (() => void) | undefined

    workflowStoreState.openWorkflows = [
      fromPartial<ComfyWorkflow>({
        path: 'first-workflow.json',
        activeState: { id: firstId, definitions: { subgraphs: [] } }
      })
    ]
    workflowServiceMocks.openWorkflow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOpen = () => {
            app.rootGraph.id = firstId
            app.rootGraph.subgraphs.set(secondId, secondGraph)
            resolve()
          }
        })
    )
    useSubgraphNavigationStore()

    routeHashRef.value = `#${firstId}`
    await vi.waitFor(() =>
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledOnce()
    )
    routeHashRef.value = `#${secondId}`
    resolveOpen?.()

    await vi.waitFor(() =>
      expect(app.canvas.setGraph).toHaveBeenLastCalledWith(secondGraph)
    )
    expect(routeHashRef.value).toBe(`#${secondId}`)
  })

  it('replays the latest graph after a workflow-backed route load', async () => {
    const firstId = ids.deletedSubgraph
    const secondId = ids.validSubgraph
    const secondGraph = makeSubgraph(secondId)
    let resolveOpen: (() => void) | undefined

    workflowStoreState.openWorkflows = [
      fromPartial<ComfyWorkflow>({
        path: 'first-workflow.json',
        activeState: { id: firstId, definitions: { subgraphs: [] } }
      })
    ]
    workflowServiceMocks.openWorkflow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOpen = () => {
            app.rootGraph.id = firstId
            app.rootGraph.subgraphs.set(secondId, secondGraph)
            app.canvas.graph = app.rootGraph
            currentGraphRef.value = app.rootGraph
            resolve()
          }
        })
    )
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
      currentGraphRef.value = graph
    })
    routerMocks.push.mockImplementation(async (target) => {
      applyRouteTarget(target)
    })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${firstId}`
    await vi.waitFor(() =>
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledOnce()
    )
    app.canvas.graph = secondGraph
    currentGraphRef.value = secondGraph
    await nextTick()
    resolveOpen?.()

    await vi.waitFor(() => {
      expect(app.canvas.graph).toBe(secondGraph)
      expect(routeHashRef.value).toBe(`#${secondId}`)
    })
  })

  it('ignores the outgoing root reset during a workflow-backed route load', async () => {
    const targetId = ids.deletedSubgraph
    const outgoingSubgraph = makeSubgraph(ids.validSubgraph)
    let resolveOpen: (() => void) | undefined

    workflowStoreState.openWorkflows = [
      fromPartial<ComfyWorkflow>({
        path: 'target-workflow.json',
        activeState: { id: targetId, definitions: { subgraphs: [] } }
      })
    ]
    workflowServiceMocks.openWorkflow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveOpen = () => {
            app.rootGraph.id = targetId
            resolve()
          }
        })
    )
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
      currentGraphRef.value = graph
    })
    app.canvas.graph = outgoingSubgraph
    currentGraphRef.value = outgoingSubgraph
    const navigationStore = useSubgraphNavigationStore()

    routeHashRef.value = `#${targetId}`
    await vi.waitFor(() =>
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledOnce()
    )
    navigationStore.saveCurrentViewport()
    app.canvas.setGraph(app.rootGraph)
    resolveOpen?.()

    await vi.waitFor(() => {
      expect(app.canvas.graph).toBe(app.rootGraph)
      expect(app.rootGraph.id).toBe(targetId)
    })
    expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledTimes(1)
    expect(routeHashRef.value).toBe(`#${targetId}`)
  })

  it('restores the active subgraph during the initial hash load', async () => {
    const subgraph = makeSubgraph(ids.validSubgraph)
    app.rootGraph.subgraphs.set(subgraph.id, subgraph)
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
      currentGraphRef.value = graph
    })
    routeHashRef.value = `#${subgraph.id}`

    const navigationStore = useSubgraphNavigationStore()
    await navigationStore.updateHash()

    expect(workflowStoreState.activeSubgraph).toBe(subgraph)
  })

  it('uses the emitted graph during a synchronous graph-change event', async () => {
    const subgraph = makeSubgraph(ids.validSubgraph)
    const navigationStore = useSubgraphNavigationStore()
    await navigationStore.updateHash()

    currentGraphRef.value = subgraph
    app.canvas.graph = subgraph
    await flushHashWatcher()

    expect(routerMocks.push).toHaveBeenCalledWith(
      expect.objectContaining({ hash: `#${subgraph.id}` })
    )
  })

  it('preserves a cross-workflow subgraph route through the final load sync', async () => {
    const targetRootId = ids.deletedSubgraph
    const targetSubgraph = makeSubgraph(ids.validSubgraph)
    const targetWorkflow = fromPartial<ComfyWorkflow>({
      path: 'target-workflow.json',
      activeState: {
        id: targetRootId,
        definitions: { subgraphs: [{ id: targetSubgraph.id }] }
      }
    })
    workflowStoreState.openWorkflows = [targetWorkflow]
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
      currentGraphRef.value = graph
    })
    const navigationStore = useSubgraphNavigationStore()
    workflowServiceMocks.openWorkflow.mockImplementation(
      async (
        _workflow: ComfyWorkflow,
        options: { navigationIntentId?: number }
      ) => {
        navigationStore.saveCurrentViewport()
        app.rootGraph.id = targetRootId
        app.rootGraph.subgraphs.set(targetSubgraph.id, targetSubgraph)
        app.canvas.setGraph(app.rootGraph)
        await navigationStore.updateHash(
          'workflow-load',
          options.navigationIntentId
        )
      }
    )

    routeHashRef.value = `#${targetSubgraph.id}`

    await vi.waitFor(() => {
      expect(app.canvas.graph).toBe(targetSubgraph)
      expect(routeHashRef.value).toBe(`#${targetSubgraph.id}`)
    })
    expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledWith(
      targetWorkflow,
      { navigationIntentId: expect.any(Number) }
    )
  })

  it('replays a settled route after an older workflow selection finishes', async () => {
    const originalRootId = ids.root
    const staleRootId = ids.deletedSubgraph
    const targetSubgraph = makeSubgraph(ids.validSubgraph)
    const originalWorkflow = fromPartial<ComfyWorkflow>({
      path: 'original-workflow.json',
      activeState: {
        id: originalRootId,
        definitions: { subgraphs: [{ id: targetSubgraph.id }] }
      }
    })
    workflowStoreState.openWorkflows = [originalWorkflow]
    app.rootGraph.subgraphs.set(targetSubgraph.id, targetSubgraph)
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
      currentGraphRef.value = graph
    })
    routeHashRef.value = `#${originalRootId}`
    const navigationStore = useSubgraphNavigationStore()
    await navigationStore.updateHash()
    const staleWorkflowNavigationId = navigationStore.beginWorkflowNavigation()

    routeHashRef.value = `#${targetSubgraph.id}`
    await vi.waitFor(() => expect(app.canvas.graph).toBe(targetSubgraph))

    navigationStore.saveCurrentViewport()
    app.rootGraph.id = staleRootId
    app.rootGraph.subgraphs.clear()
    app.canvas.setGraph(app.rootGraph)
    workflowServiceMocks.openWorkflow.mockImplementation(
      async (
        _workflow: ComfyWorkflow,
        options: { navigationIntentId?: number }
      ) => {
        navigationStore.saveCurrentViewport()
        app.rootGraph.id = originalRootId
        app.rootGraph.subgraphs.set(targetSubgraph.id, targetSubgraph)
        app.canvas.setGraph(app.rootGraph)
        await navigationStore.updateHash(
          'workflow-load',
          options.navigationIntentId
        )
      }
    )

    await navigationStore.updateHash('workflow-load', staleWorkflowNavigationId)

    expect(app.canvas.graph).toBe(targetSubgraph)
    expect(routeHashRef.value).toBe(`#${targetSubgraph.id}`)
    expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledWith(
      originalWorkflow,
      { navigationIntentId: expect.any(Number) }
    )
  })

  it('clears an unused workflow reset before a real root navigation', async () => {
    const subgraph = makeSubgraph(ids.validSubgraph)
    app.rootGraph.subgraphs.set(subgraph.id, subgraph)
    app.canvas.graph = subgraph
    currentGraphRef.value = subgraph
    routeHashRef.value = `#${subgraph.id}`
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
      currentGraphRef.value = graph
    })
    const navigationStore = useSubgraphNavigationStore()
    await navigationStore.updateHash()

    navigationStore.saveCurrentViewport()
    await navigationStore.updateHash('workflow-load')
    app.canvas.setGraph(app.rootGraph)

    await vi.waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
    )
    expect(routeHashRef.value).toBe(`#${app.rootGraph.id}`)
  })

  it('does not suppress root navigation after a clean-false load fails', async () => {
    const subgraph = makeSubgraph(ids.validSubgraph)
    app.rootGraph.subgraphs.set(subgraph.id, subgraph)
    app.canvas.graph = subgraph
    currentGraphRef.value = subgraph
    routeHashRef.value = `#${subgraph.id}`
    vi.mocked(app.canvas.setGraph).mockImplementation((graph) => {
      app.canvas.graph = graph
      currentGraphRef.value = graph
    })
    const navigationStore = useSubgraphNavigationStore()
    await navigationStore.updateHash()

    navigationStore.saveCurrentViewport(false)
    app.canvas.setGraph(app.rootGraph)

    await vi.waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
    )
    expect(routeHashRef.value).toBe(`#${app.rootGraph.id}`)
  })

  it('drops an older queued graph hash after a newer workflow route', async () => {
    const firstId = '33333333-3333-4333-8333-333333333333'
    const secondId = '44444444-4444-4444-8444-444444444444'
    const routeId = ids.deletedSubgraph
    const firstGraph = makeSubgraph(firstId)
    const secondGraph = makeSubgraph(secondId)
    const routeWorkflow = fromPartial<ComfyWorkflow>({
      path: 'route-workflow.json',
      activeState: { id: routeId, definitions: { subgraphs: [] } }
    })
    let resolveFirstPush: (() => void) | undefined

    workflowStoreState.openWorkflows = [routeWorkflow]
    workflowServiceMocks.openWorkflow.mockImplementation(async () => {
      app.rootGraph.id = routeId
      app.canvas.graph = app.rootGraph
      currentGraphRef.value = app.rootGraph
    })
    routerMocks.push
      .mockImplementationOnce((target) => {
        applyRouteTarget(target)
        return new Promise<void>((resolve) => {
          resolveFirstPush = resolve
        })
      })
      .mockImplementation(async (target) => {
        applyRouteTarget(target)
      })
    const navigationStore = useSubgraphNavigationStore()
    await navigationStore.updateHash()

    app.canvas.graph = firstGraph
    currentGraphRef.value = firstGraph
    await vi.waitFor(() =>
      expect(routerMocks.push).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${firstId}` })
      )
    )
    app.canvas.graph = secondGraph
    currentGraphRef.value = secondGraph
    routeHashRef.value = `#${routeId}`

    await vi.waitFor(() =>
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledWith(
        routeWorkflow,
        { navigationIntentId: expect.any(Number) }
      )
    )
    resolveFirstPush?.()
    await vi.waitFor(() => expect(app.canvas.graph).toBe(app.rootGraph))

    expect(routerMocks.push).toHaveBeenCalledTimes(1)
    expect(routeHashRef.value).toBe(`#${routeId}`)
  })

  it('updates the route after replaying a workflow root graph', async () => {
    const firstId = ids.deletedSubgraph
    const secondId = ids.validSubgraph
    const firstWorkflow = fromPartial<ComfyWorkflow>({
      path: 'first-workflow.json',
      activeState: { id: firstId, definitions: { subgraphs: [] } }
    })
    const secondWorkflow = fromPartial<ComfyWorkflow>({
      path: 'second-workflow.json',
      activeState: { id: secondId, definitions: { subgraphs: [] } }
    })
    const secondRoot = fromPartial<LGraph>({ id: secondId })
    let resolveFirstOpen: (() => void) | undefined

    workflowStoreState.openWorkflows = [firstWorkflow, secondWorkflow]
    workflowServiceMocks.openWorkflow.mockImplementation((workflow) => {
      if (workflow === firstWorkflow) {
        return new Promise<void>((resolve) => {
          resolveFirstOpen = () => {
            app.rootGraph.id = firstId
            app.canvas.graph = app.rootGraph
            currentGraphRef.value = app.rootGraph
            resolve()
          }
        })
      }
      app.rootGraph.id = secondId
      app.canvas.graph = app.rootGraph
      currentGraphRef.value = app.rootGraph
      return Promise.resolve()
    })
    routerMocks.push.mockImplementation(async (target) => {
      applyRouteTarget(target)
    })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${firstId}`
    await vi.waitFor(() =>
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledWith(
        firstWorkflow,
        { navigationIntentId: expect.any(Number) }
      )
    )
    app.canvas.graph = secondRoot
    currentGraphRef.value = secondRoot
    resolveFirstOpen?.()

    await vi.waitFor(() => {
      expect(workflowServiceMocks.openWorkflow).toHaveBeenLastCalledWith(
        secondWorkflow,
        { navigationIntentId: expect.any(Number) }
      )
      expect(app.canvas.graph?.id).toBe(secondId)
      expect(routeHashRef.value).toBe(`#${secondId}`)
    })
  })

  it('does not recover an older failed route over a newer route', async () => {
    const firstId = ids.deletedSubgraph
    const secondId = ids.validSubgraph
    const firstWorkflow = fromPartial<ComfyWorkflow>({
      path: 'first-workflow.json',
      activeState: { id: firstId, definitions: { subgraphs: [] } }
    })
    const secondWorkflow = fromPartial<ComfyWorkflow>({
      path: 'second-workflow.json',
      activeState: { id: secondId, definitions: { subgraphs: [] } }
    })
    let rejectFirstOpen: ((error: Error) => void) | undefined

    workflowStoreState.openWorkflows = [firstWorkflow, secondWorkflow]
    workflowServiceMocks.openWorkflow.mockImplementation((workflow) => {
      if (workflow === firstWorkflow) {
        return new Promise<void>((_resolve, reject) => {
          rejectFirstOpen = reject
        })
      }
      app.rootGraph.id = secondId
      app.canvas.graph = app.rootGraph
      currentGraphRef.value = app.rootGraph
      return Promise.resolve()
    })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${firstId}`
    await vi.waitFor(() =>
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledWith(
        firstWorkflow,
        { navigationIntentId: expect.any(Number) }
      )
    )
    routeHashRef.value = `#${secondId}`
    rejectFirstOpen?.(new Error('first route failed'))

    await vi.waitFor(() => {
      expect(workflowServiceMocks.openWorkflow).toHaveBeenLastCalledWith(
        secondWorkflow,
        { navigationIntentId: expect.any(Number) }
      )
      expect(app.canvas.graph?.id).toBe(secondId)
    })
    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(routeHashRef.value).toBe(`#${secondId}`)
  })

  it('does not let an older route that RESOLVES late redirect over a newer route', async () => {
    const firstId = ids.deletedSubgraph
    const secondId = ids.validSubgraph
    const firstWorkflow = fromPartial<ComfyWorkflow>({
      path: 'first-workflow.json',
      activeState: { id: firstId, definitions: { subgraphs: [] } }
    })
    const secondWorkflow = fromPartial<ComfyWorkflow>({
      path: 'second-workflow.json',
      activeState: { id: secondId, definitions: { subgraphs: [] } }
    })
    let resolveFirstOpen: (() => void) | undefined

    workflowStoreState.openWorkflows = [firstWorkflow, secondWorkflow]
    workflowServiceMocks.openWorkflow.mockImplementation((workflow) => {
      if (workflow === firstWorkflow) {
        return new Promise<void>((resolve) => {
          resolveFirstOpen = resolve
        })
      }
      app.rootGraph.id = secondId
      app.canvas.graph = app.rootGraph
      currentGraphRef.value = app.rootGraph
      return Promise.resolve()
    })
    useSubgraphNavigationStore()

    routeHashRef.value = `#${firstId}`
    await vi.waitFor(() =>
      expect(workflowServiceMocks.openWorkflow).toHaveBeenCalledWith(
        firstWorkflow,
        { navigationIntentId: expect.any(Number) }
      )
    )
    routeHashRef.value = `#${secondId}`
    // The stale navigation completes SUCCESSFULLY (not rejected) while a
    // newer route is pending; its locator is gone from the new root - the
    // recovery redirect must not fire over the newer navigation.
    resolveFirstOpen?.()

    await vi.waitFor(() => {
      expect(workflowServiceMocks.openWorkflow).toHaveBeenLastCalledWith(
        secondWorkflow,
        { navigationIntentId: expect.any(Number) }
      )
      expect(app.canvas.graph?.id).toBe(secondId)
    })
    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(routeHashRef.value).toBe(`#${secondId}`)
  })

  it('a stale workflow-load id reapplies the latest graph intent', async () => {
    const subgraph = makeSubgraph(ids.validSubgraph)
    app.rootGraph.subgraphs.set(subgraph.id, subgraph)
    const store = useSubgraphNavigationStore()
    // Consume the initial-load swallow so the watcher publish is live.
    await store.updateHash('graph', undefined, app.rootGraph)

    currentGraphRef.value = subgraph
    await vi.waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${ids.validSubgraph}` })
      )
    })
    vi.mocked(app.canvas.setGraph).mockClear()

    // The mock canvas never left the root, so reapplying the live graph
    // intent must drive setGraph at the stale publish.
    await store.updateHash('workflow-load', -1)

    expect(app.canvas.setGraph).toHaveBeenCalledWith(subgraph)
  })

  it('a workflow-load publish clears the pending reset suppression even for a stale id', async () => {
    const subgraph = makeSubgraph(ids.validSubgraph)
    app.rootGraph.subgraphs.set(subgraph.id, subgraph)
    const store = useSubgraphNavigationStore()
    // Consume the initial-load swallow so the later publish is live.
    await store.updateHash('graph', undefined, app.rootGraph)

    // A workflow switch arms the suppression while the canvas sits inside a
    // subgraph; the load then fails so ONLY the finally-publish (stale id by
    // then) runs. Without the entry-point clear this strands the suppression
    // and swallows the next root publish.
    app.canvas.graph = subgraph
    store.saveCurrentViewport(true)
    app.canvas.graph = app.rootGraph
    await store.updateHash('workflow-load', -1)

    await store.updateHash('graph', undefined, app.rootGraph)

    await vi.waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${ids.root}` })
      )
    })
  })

  it('ignores endWorkflowNavigation for a superseded intent id', async () => {
    app.rootGraph.id = ids.root
    app.canvas.graph = app.rootGraph
    currentGraphRef.value = app.rootGraph
    routeHashRef.value = ''
    const store = useSubgraphNavigationStore()

    const olderId = store.beginWorkflowNavigation()
    store.beginWorkflowNavigation()
    store.endWorkflowNavigation(olderId)
    await Promise.resolve()
    await Promise.resolve()

    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(routerMocks.push).not.toHaveBeenCalled()
  })

  it('routeHash watcher does not re-enter navigateToHash during recovery redirect', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Simulate the real router replace: trigger the routeHash watcher
    // exactly the way vue-router does when the URL is replaced.
    routerMocks.replace.mockImplementation((target) => {
      applyRouteTarget(target)
      return Promise.resolve(undefined)
    })
    app.canvas.graph = makeSubgraph(ids.deletedSubgraph)
    useSubgraphNavigationStore()

    routeHashRef.value = `#${ids.deletedSubgraph}`
    await vi.waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith(
        expect.objectContaining({ hash: `#${app.rootGraph.id}` })
      )
    })

    // navigateToHash for the deleted id ran once and produced exactly one
    // redirect. The watcher must NOT have fired again for the rewritten
    // (root) hash and produced a second redirect.
    await flushHashWatcher()
    expect(routerMocks.replace).toHaveBeenCalledTimes(1)
    expect(app.canvas.setGraph).toHaveBeenCalledWith(app.rootGraph)
    warnSpy.mockRestore()
  })
})
