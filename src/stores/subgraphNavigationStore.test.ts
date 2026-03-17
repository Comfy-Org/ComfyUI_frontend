import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

import type { Subgraph } from '@/lib/litegraph/src/LGraph'

vi.mock('@/scripts/app', () => {
  const mockCanvas = {
    subgraph: null,
    ds: {
      scale: 1,
      offset: [0, 0],
      state: {
        scale: 1,
        offset: [0, 0]
      }
    },
    setDirty: vi.fn()
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

describe('useSubgraphNavigationStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('should not clear navigation stack when workflow internal state changes', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()

    // Mock a workflow
    const mockWorkflow = {
      path: 'test-workflow.json',
      filename: 'test-workflow.json',
      changeTracker: null
    } as ComfyWorkflow

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

    const workflow1 = {
      path: 'workflow1.json',
      filename: 'workflow1.json'
    } as ComfyWorkflow

    const workflow2 = {
      path: 'workflow2.json',
      filename: 'workflow2.json'
    } as ComfyWorkflow

    const sub1 = {
      id: 'sub-1',
      rootGraph: app.rootGraph,
      _nodes: [],
      nodes: []
    } as Partial<Subgraph> as Subgraph

    const sub2 = {
      id: 'sub-2',
      rootGraph: app.rootGraph,
      _nodes: [],
      nodes: []
    } as Partial<Subgraph> as Subgraph

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

    const workflow1 = {
      path: 'workflow1.json',
      filename: 'workflow1.json'
    } as ComfyWorkflow

    const workflow1Subgraph = {
      id: 'sub-1',
      rootGraph: app.rootGraph,
      _nodes: [],
      nodes: []
    } as Partial<Subgraph> as Subgraph

    app.rootGraph.subgraphs.set(workflow1Subgraph.id, workflow1Subgraph)
    vi.mocked(findSubgraphPathById).mockImplementation((_rootGraph, id) =>
      id === workflow1Subgraph.id ? [workflow1Subgraph.id] : null
    )

    app.canvas.subgraph = workflow1Subgraph

    workflowStore.activeWorkflow =
      workflow1 as typeof workflowStore.activeWorkflow
    await nextTick()

    expect(navigationStore.exportState()).toEqual([workflow1Subgraph.id])

    const workflow2 = {
      path: 'workflow2.json',
      filename: 'workflow2.json'
    } as ComfyWorkflow

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

  it('should clear navigation when activeSubgraph becomes undefined', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()
    const { findSubgraphPathById } = await import('@/utils/graphTraversalUtil')

    // Create mock subgraph and graph structure
    const mockSubgraph = {
      id: 'subgraph-1',
      rootGraph: app.graph,
      _nodes: [],
      nodes: []
    } as Partial<Subgraph> as Subgraph

    // Add the subgraph to the graph's subgraphs map
    app.graph.subgraphs.set('subgraph-1', mockSubgraph)

    // First set an active workflow
    const mockWorkflow = {
      path: 'test-workflow.json',
      filename: 'test-workflow.json'
    } as ComfyWorkflow

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
})
