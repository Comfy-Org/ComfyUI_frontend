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

  it('should clear navigation stack when switching to a different workflow', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()

    // Mock first workflow
    const workflow1 = {
      path: 'workflow1.json',
      filename: 'workflow1.json'
    } as ComfyWorkflow

    // Set the active workflow
    workflowStore.activeWorkflow = workflow1 as any

    // Simulate being in a subgraph
    navigationStore.restoreState(['subgraph-1', 'subgraph-2'])

    expect(navigationStore.exportState()).toHaveLength(2)

    // Switch to a different workflow
    const workflow2 = {
      path: 'workflow2.json',
      filename: 'workflow2.json'
    } as ComfyWorkflow

    workflowStore.activeWorkflow = workflow2 as any

    // Wait for Vue's reactivity to process the change
    await nextTick()

    // The navigation stack SHOULD be cleared because we switched workflows
    expect(navigationStore.exportState()).toHaveLength(0)
  })

  it('should handle null workflow gracefully', async () => {
    const navigationStore = useSubgraphNavigationStore()
    const workflowStore = useWorkflowStore()

    // First set an active workflow
    const mockWorkflow = {
      path: 'test-workflow.json',
      filename: 'test-workflow.json'
    } as ComfyWorkflow

    workflowStore.activeWorkflow = mockWorkflow as any
    await nextTick()

    // Add some items to the navigation stack
    navigationStore.restoreState(['subgraph-1'])
    expect(navigationStore.exportState()).toHaveLength(1)

    // Set workflow to null
    workflowStore.activeWorkflow = null

    // Wait for Vue's reactivity to process the change
    await nextTick()

    // Stack should be cleared when workflow becomes null
    expect(navigationStore.exportState()).toHaveLength(0)
  })
})
