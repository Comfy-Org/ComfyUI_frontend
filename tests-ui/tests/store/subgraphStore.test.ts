import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { app } from '@/scripts/app'
import { useSubgraphStore } from '@/stores/subgraphStore'

vi.mock('@/scripts/app', () => ({
  app: {
    graph: null
  }
}))

const mockWorkflowStore = {
  activeWorkflow: {
    filename: 'test.workflow',
    path: 'test.workflow'
  }
}

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => mockWorkflowStore)
}))

describe('useSubgraphStore', () => {
  let store: ReturnType<typeof useSubgraphStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSubgraphStore()
    vi.clearAllMocks()
  })

  it('should initialize with default values', () => {
    expect(store.graphNamePath).toEqual([])
    expect(store.isSubgraphActive).toBe(false)
  })

  describe('No Subgraphs exist', () => {
    it('should update paths when active workflow changes', async () => {
      const mockName = 'Not a Subgraph'
      const mockId = 'this-is-not-a-subgraph'
      const mockRootGraph = {
        id: mockId
        // Non-subgraph does not have `parent` or a `name` properties for now
      }

      mockWorkflowStore.activeWorkflow.filename = mockName
      mockWorkflowStore.activeWorkflow.path = mockId
      vi.spyOn(app, 'graph', 'get').mockReturnValue(mockRootGraph as any)

      store.updateActiveGraph()
      await nextTick()

      expect(store.graphNamePath).toEqual([mockName])
    })
  })

  describe('Subgraphs exist', () => {
    it('should update paths when active workflow changes', async () => {
      const mockSubgraph = {
        id: 'subgraph-2',
        name: 'Subgraph 2',
        parent: {
          id: 'subgraph-1',
          name: 'Subgraph 1',
          parent: {
            id: 'root-graph'
          }
        }
      }

      // Update the active workflow name
      mockWorkflowStore.activeWorkflow.filename = 'Root Graph'

      // Mock the app.graph getter
      vi.spyOn(app, 'graph', 'get').mockReturnValue(mockSubgraph as any)

      // Trigger the update
      store.updateActiveGraph()
      await nextTick()

      expect(store.graphNamePath).toEqual([
        'Root Graph',
        'Subgraph 1',
        'Subgraph 2'
      ])
    })
  })
})
