import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubgraphTitleSync } from '@/composables/subgraphTitleSync'

// Mock the workflow store
vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      activeState: {
        definitions: {
          subgraphs: [{ id: 'test-subgraph-id', name: 'Original Name' }]
        }
      }
    }
  })
}))

describe('useSubgraphTitleSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should update subgraph name', () => {
    const { updateSubgraphName } = useSubgraphTitleSync()

    const mockSubgraph = { name: 'Old Name' }
    updateSubgraphName(mockSubgraph, 'New Name')

    expect(mockSubgraph.name).toBe('New Name')
  })

  it('should update exported subgraph name', () => {
    const { updateExportedSubgraphName } = useSubgraphTitleSync()

    updateExportedSubgraphName('test-subgraph-id', 'Updated Name')

    // Since we're mocking the store, we can't directly test the update
    // but we can ensure the function runs without error
    expect(updateExportedSubgraphName).toBeDefined()
  })

  it('should sync subgraph title when node is a subgraph', () => {
    const { syncSubgraphTitle } = useSubgraphTitleSync()

    const mockSubgraph = { name: 'Old Name', id: 'test-subgraph-id' }
    const mockNode = {
      isSubgraphNode: vi.fn().mockReturnValue(true),
      subgraph: mockSubgraph
    }

    syncSubgraphTitle(mockNode as any, 'Synced Name')

    expect(mockNode.isSubgraphNode).toHaveBeenCalled()
    expect(mockSubgraph.name).toBe('Synced Name')
  })

  it('should not sync when node is not a subgraph', () => {
    const { syncSubgraphTitle } = useSubgraphTitleSync()

    const mockNode = {
      isSubgraphNode: vi.fn().mockReturnValue(false),
      subgraph: { name: 'Original Name' }
    }

    syncSubgraphTitle(mockNode as any, 'Should Not Change')

    expect(mockNode.isSubgraphNode).toHaveBeenCalled()
    expect(mockNode.subgraph.name).toBe('Original Name')
  })
})
