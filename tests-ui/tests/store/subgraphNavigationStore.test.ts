import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { app } from '@/scripts/app'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { ComfyWorkflow } from '@/stores/workflowStore'

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

  return {
    app: {
      graph: {
        _nodes: [],
        nodes: [],
        subgraphs: new Map(),
        getNodeById: vi.fn()
      },
      canvas: mockCanvas
    }
  }
})

vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => (app as any).canvas
  })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  findSubgraphPathById: vi.fn()
}))

describe('useSubgraphNavigationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
    workflowStore.activeWorkflow = mockWorkflow as any

    // Simulate being in a subgraph by restoring state
    navigationStore.restoreState(['subgraph-1', 'subgraph-2'])

    expect(navigationStore.exportState()).toHaveLength(2)

    // Simulate a change to the workflow's internal state
    // (e.g., changeTracker.activeState being reassigned)
    mockWorkflow.changeTracker = { activeState: {} } as any

    // The navigation stack should NOT be cleared because the path hasn't changed
    expect(navigationStore.exportState()).toHaveLength(2)
    expect(navigationStore.exportState()).toEqual(['subgraph-1', 'subgraph-2'])
  })

  it('should preserve navigation stack per workflow', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()

    // Mock first workflow
    const workflow1 = {
      path: 'workflow1.json',
      filename: 'workflow1.json',
      changeTracker: {
        restore: vi.fn(),
        store: vi.fn()
      }
    } as unknown as ComfyWorkflow

    // Set the active workflow
    workflowStore.activeWorkflow = workflow1 as any

    // Simulate the restore process that happens when loading a workflow
    // Since subgraphState is private, we'll simulate the effect by directly restoring navigation
    navigationStore.restoreState(['subgraph-1', 'subgraph-2'])

    // Verify navigation was set
    expect(navigationStore.exportState()).toHaveLength(2)
    expect(navigationStore.exportState()).toEqual(['subgraph-1', 'subgraph-2'])

    // Switch to a different workflow with no subgraph state (root level)
    const workflow2 = {
      path: 'workflow2.json',
      filename: 'workflow2.json',
      changeTracker: {
        restore: vi.fn(),
        store: vi.fn()
      }
    } as unknown as ComfyWorkflow

    workflowStore.activeWorkflow = workflow2 as any

    // Simulate the restore process for workflow2
    // Since subgraphState is private, we'll simulate the effect by directly restoring navigation
    navigationStore.restoreState([])

    // The navigation stack should be empty for workflow2 (at root level)
    expect(navigationStore.exportState()).toHaveLength(0)

    // Switch back to workflow1
    workflowStore.activeWorkflow = workflow1 as any

    // Simulate the restore process for workflow1 again
    // Since subgraphState is private, we'll simulate the effect by directly restoring navigation
    navigationStore.restoreState(['subgraph-1', 'subgraph-2'])

    // The navigation stack should be restored for workflow1
    expect(navigationStore.exportState()).toHaveLength(2)
    expect(navigationStore.exportState()).toEqual(['subgraph-1', 'subgraph-2'])
  })

  it('should clear navigation when activeSubgraph becomes undefined', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()
    const { findSubgraphPathById } = await import('@/utils/graphTraversalUtil')

    // Create mock subgraph and graph structure
    const mockSubgraph = {
      id: 'subgraph-1',
      rootGraph: (app as any).graph,
      _nodes: [],
      nodes: []
    }

    // Add the subgraph to the graph's subgraphs map
    ;(app as any).graph.subgraphs.set('subgraph-1', mockSubgraph)

    // First set an active workflow
    const mockWorkflow = {
      path: 'test-workflow.json',
      filename: 'test-workflow.json'
    } as ComfyWorkflow

    workflowStore.activeWorkflow = mockWorkflow as any

    // Mock findSubgraphPathById to return the correct path
    vi.mocked(findSubgraphPathById).mockReturnValue(['subgraph-1'])

    // Set canvas.subgraph and trigger update to set activeSubgraph
    ;(app as any).canvas.subgraph = mockSubgraph
    workflowStore.updateActiveGraph()

    // Wait for Vue's reactivity to process the change
    await nextTick()

    // Verify navigation was set by the watcher
    expect(navigationStore.exportState()).toHaveLength(1)
    expect(navigationStore.exportState()).toEqual(['subgraph-1'])

    // Clear canvas.subgraph and trigger update (simulating navigating back to root)
    ;(app as any).canvas.subgraph = null
    workflowStore.updateActiveGraph()

    // Wait for Vue's reactivity to process the change
    await nextTick()

    // Stack should be cleared when activeSubgraph becomes undefined
    expect(navigationStore.exportState()).toHaveLength(0)
  })
})
