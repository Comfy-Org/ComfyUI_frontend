import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useExecutionStore } from '@/stores/executionStore'

// Mock factory function to create a root graph
const createMockRootGraph = (
  options: Partial<Pick<LGraph, 'getNodeById' | 'nodes'>> = {}
): Partial<LGraph> => ({
  getNodeById: options.getNodeById ?? vi.fn(() => null),
  nodes: options.nodes ?? [],
  ...options
})

// Mock factory function to create a subgraph node
const createMockSubgraphNode = (
  nodeId: string,
  subgraphNodeId: string,
  innerNode: LGraphNode
): LGraphNode =>
  ({
    id: nodeId,
    title: 'Node In Subgraph',
    type: 'SubgraphNode',
    isSubgraphNode: (() => true) as any,
    subgraph: {
      id: 'sub-uuid',
      getNodeById: vi.fn((id) => (id === subgraphNodeId ? innerNode : null)),
      _nodes: []
    } as Partial<LGraph>
  }) as unknown as LGraphNode

// Create mock functions
const mockNodeExecutionIdToNodeLocatorId = vi.fn()
const mockNodeIdToNodeLocatorId = vi.fn()
const mockNodeLocatorIdToNodeExecutionId = vi.fn()

// Keep track of the current mock root graph
const mockAppState = {
  rootGraph: createMockRootGraph()
}

// Mock the app import with proper implementation
vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mockAppState.rootGraph
    },
    set rootGraph(value) {
      mockAppState.rootGraph = value
    },
    revokePreviews: vi.fn(),
    nodePreviewImages: {}
  }
}))

// Mock the workflowStore
vi.mock(
  '@/platform/workflow/management/stores/workflowStore',
  async (importOriginal) => {
    const { ComfyWorkflow } =
      await importOriginal<
        typeof import('@/platform/workflow/management/stores/workflowStore')
      >()
    return {
      ComfyWorkflow,
      useWorkflowStore: vi.fn(() => ({
        nodeExecutionIdToNodeLocatorId: mockNodeExecutionIdToNodeLocatorId,
        nodeIdToNodeLocatorId: mockNodeIdToNodeLocatorId,
        nodeLocatorIdToNodeExecutionId: mockNodeLocatorIdToNodeExecutionId
      }))
    }
  }
)

vi.mock('@/composables/node/useNodeProgressText', () => ({
  useNodeProgressText: () => ({
    showTextPreview: vi.fn()
  })
}))

describe('useExecutionStore - executingNode with subgraphs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Reset the mock root graph using factory
    mockAppState.rootGraph = createMockRootGraph()
  })

  it('should find executing node in root graph', () => {
    const mockNode = {
      id: '123',
      title: 'Test Node',
      type: 'TestNode'
    } as LGraphNode

    mockAppState.rootGraph = createMockRootGraph({
      getNodeById: vi.fn((id) => (id === '123' ? mockNode : null))
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

    const mockSubgraphNode = createMockSubgraphNode(
      '456',
      '789',
      mockNodeInSubgraph
    ) as LGraphNode

    mockAppState.rootGraph = createMockRootGraph({
      getNodeById: vi.fn((id) => (id === '456' ? mockSubgraphNode : null))
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
    mockAppState.rootGraph = createMockRootGraph({
      getNodeById: vi.fn(() => null)
    })

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
