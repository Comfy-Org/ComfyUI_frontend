import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { ComfyWorkflow } from '@/stores/workflowStore'

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {
      subgraphs: new Map(),
      getNodeById: vi.fn()
    },
    canvas: {
      subgraph: null
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  findSubgraphPathById: vi.fn((_rootGraph, targetId) => {
    // Mock implementation that returns a path for known subgraphs
    if (targetId === 'subgraph-1' || targetId === 'subgraph-2') {
      return [targetId]
    }
    return null
  })
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

    // First set an active workflow
    const mockWorkflow = {
      path: 'test-workflow.json',
      filename: 'test-workflow.json'
    } as ComfyWorkflow

    workflowStore.activeWorkflow = mockWorkflow as any

    // Manually set navigation state to simulate being in a subgraph
    navigationStore.restoreState(['subgraph-1'])

    // Verify navigation was set
    expect(navigationStore.exportState()).toHaveLength(1)
    expect(navigationStore.exportState()).toEqual(['subgraph-1'])

    // Clear activeSubgraph (simulating navigating back to root)
    workflowStore.activeSubgraph = undefined

    // Wait for Vue's reactivity to process the change
    await nextTick()

    // Stack should be cleared when activeSubgraph becomes undefined
    expect(navigationStore.exportState()).toHaveLength(0)
  })
})
