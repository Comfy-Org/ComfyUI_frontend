import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useExecutionStore } from '@/stores/executionStore'

// Create mock functions
const mockNodeExecutionIdToNodeLocatorId = vi.fn()
const mockNodeIdToNodeLocatorId = vi.fn()
const mockNodeLocatorIdToNodeExecutionId = vi.fn()

// Create a mocked graph that we can manipulate
let mockRootGraph: any

// Mock the app import with proper implementation
vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mockRootGraph
    },
    revokePreviews: vi.fn(),
    nodePreviewImages: {}
  }
}))

// Mock the workflowStore
vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { ComfyWorkflow } = await vi.importActual<
    typeof import('@/platform/workflow/management/stores/workflowStore')
  >('@/platform/workflow/management/stores/workflowStore')
  return {
    ComfyWorkflow,
    useWorkflowStore: vi.fn(() => ({
      nodeExecutionIdToNodeLocatorId: mockNodeExecutionIdToNodeLocatorId,
      nodeIdToNodeLocatorId: mockNodeIdToNodeLocatorId,
      nodeLocatorIdToNodeExecutionId: mockNodeLocatorIdToNodeExecutionId
    }))
  }
})

vi.mock('@/composables/node/useNodeProgressText', () => ({
  useNodeProgressText: () => ({
    showTextPreview: vi.fn()
  })
}))

describe('useExecutionStore - executingNode with subgraphs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Reset the mock root graph
    mockRootGraph = {
      getNodeById: vi.fn(),
      nodes: []
    }
  })

  it('should find executing node in root graph', () => {
    const mockNode = {
      id: '123',
      title: 'Test Node',
      type: 'TestNode'
    } as LGraphNode

    mockRootGraph.getNodeById = vi.fn((id) => {
      return id === '123' ? mockNode : null
    })

    const store = useExecutionStore()

    // Simulate node execution starting
    store.nodeProgressStates = {
      '123': {
        state: 'running',
        value: 0,
        max: 100,
        display_node_id: '123',
        prompt_id: 'test-prompt',
        node_id: '123'
      }
    }

    expect(store.executingNode).toBe(mockNode)
  })

  it('should find executing node in subgraph using execution ID', () => {
    const mockNodeInSubgraph = {
      id: '789',
      title: 'Nested Node',
      type: 'NestedNode'
    } as LGraphNode

    const mockSubgraphNode = {
      id: '456',
      title: 'Node In Subgraph',
      type: 'SubgraphNode',
      isSubgraphNode: () => true,
      subgraph: {
        id: 'sub-uuid',
        getNodeById: vi.fn((id) => {
          return id === '789' ? mockNodeInSubgraph : null
        }),
        _nodes: []
      }
    } as unknown as LGraphNode

    // Mock the graph traversal
    mockRootGraph.getNodeById = vi.fn((id) => {
      return id === '456' ? mockSubgraphNode : null
    })

    const store = useExecutionStore()

    // Simulate node execution in subgraph with hierarchical execution ID "456:789"
    store.nodeProgressStates = {
      '456:789': {
        state: 'running',
        value: 0,
        max: 100,
        display_node_id: '456:789',
        prompt_id: 'test-prompt',
        node_id: '456:789'
      }
    }

    // The executingNode should resolve to the nested node
    expect(store.executingNode).toBe(mockNodeInSubgraph)
  })

  it('should return null when no node is executing', () => {
    const store = useExecutionStore()

    store.nodeProgressStates = {}

    expect(store.executingNode).toBeNull()
  })

  it('should return null when executing node cannot be found', () => {
    mockRootGraph.getNodeById = vi.fn(() => null)

    const store = useExecutionStore()

    store.nodeProgressStates = {
      '999': {
        state: 'running',
        value: 0,
        max: 100,
        display_node_id: '999',
        prompt_id: 'test-prompt',
        node_id: '999'
      }
    }

    expect(store.executingNode).toBeNull()
  })
})
