import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '../litegraph/subgraph/fixtures/subgraphHelpers'

// Create mock functions that will be shared
const mockNodeExecutionIdToNodeLocatorId = vi.fn()
const mockNodeIdToNodeLocatorId = vi.fn()
const mockNodeLocatorIdToNodeExecutionId = vi.fn()

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

// Remove any previous global types
declare global {
  interface Window {}
}

vi.mock('@/composables/node/useNodeProgressText', () => ({
  useNodeProgressText: () => ({
    showTextPreview: vi.fn()
  })
}))

// Mock the app import with proper implementation
vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      getNodeById: vi.fn(),
      nodes: [] // Add nodes array for workflowStore iteration
    },
    revokePreviews: vi.fn(),
    nodePreviewImages: {}
  }
}))

describe('useExecutionStore - NodeLocatorId conversions', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockNodeExecutionIdToNodeLocatorId.mockReset()
    mockNodeIdToNodeLocatorId.mockReset()
    mockNodeLocatorIdToNodeExecutionId.mockReset()

    setActivePinia(createPinia())
    store = useExecutionStore()
  })

  describe('executionIdToNodeLocatorId', () => {
    it('should convert execution ID to NodeLocatorId', () => {
      // Mock subgraph structure
      const mockSubgraph = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        nodes: []
      }

      const mockNode = {
        id: 123,
        isSubgraphNode: () => true,
        subgraph: mockSubgraph
      } as any

      // Mock app.rootGraph.getNodeById to return the mock node
      vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

      const result = store.executionIdToNodeLocatorId('123:456')

      expect(result).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890:456')
    })

    it('should convert simple node ID to NodeLocatorId', () => {
      const result = store.executionIdToNodeLocatorId('123')

      // For simple node IDs, it should return the ID as-is
      expect(result).toBe('123')
    })

    it('should handle numeric node IDs', () => {
      const result = store.executionIdToNodeLocatorId(123)

      // For numeric IDs, it should convert to string and return as-is
      expect(result).toBe('123')
    })

    it('should return undefined when conversion fails', () => {
      // Mock app.rootGraph.getNodeById to return null (node not found)
      vi.mocked(app.rootGraph.getNodeById).mockReturnValue(null)

      expect(store.executionIdToNodeLocatorId('999:456')).toBe(undefined)
    })
  })

  describe('nodeLocatorIdToExecutionId', () => {
    it('should convert NodeLocatorId to execution ID', () => {
      const mockExecutionId = '123:456'
      mockNodeLocatorIdToNodeExecutionId.mockReturnValue(mockExecutionId)

      const result = store.nodeLocatorIdToExecutionId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890:456'
      )

      expect(mockNodeLocatorIdToNodeExecutionId).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890:456'
      )
      expect(result).toBe(mockExecutionId)
    })

    it('should return null when conversion fails', () => {
      mockNodeLocatorIdToNodeExecutionId.mockReturnValue(null)

      const result = store.nodeLocatorIdToExecutionId('invalid:format')

      expect(result).toBeNull()
    })
  })
})

describe('useExecutionStore - Node Error Lookups', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useExecutionStore()
  })

  describe('getNodeErrors', () => {
    it('should return undefined when no errors exist', () => {
      const result = store.getNodeErrors('123')
      expect(result).toBeUndefined()
    })

    it('should return node error by locator ID for root graph node', () => {
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      }

      const result = store.getNodeErrors('123')
      expect(result).toBeDefined()
      expect(result?.errors).toHaveLength(1)
      expect(result?.errors[0].message).toBe('Invalid input')
    })

    it('should return node error by locator ID for subgraph node', () => {
      const subgraphUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const mockSubgraph = {
        id: subgraphUuid,
        getNodeById: vi.fn(),
        nodes: []
      }

      const mockNode = {
        id: 123,
        isSubgraphNode: () => true,
        subgraph: mockSubgraph
      } as any

      vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

      store.lastNodeErrors = {
        '123:456': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid subgraph input',
              details: 'Missing required input',
              extra_info: { input_name: 'image' }
            }
          ],
          class_type: 'SubgraphNode',
          dependent_outputs: []
        }
      }

      const locatorId = `${subgraphUuid}:456`
      const result = store.getNodeErrors(locatorId)
      expect(result).toBeDefined()
      expect(result?.errors[0].message).toBe('Invalid subgraph input')
    })
  })

  describe('slotHasError', () => {
    it('should return false when node has no errors', () => {
      const result = store.slotHasError('123', 'width')
      expect(result).toBe(false)
    })

    it('should return false when node has errors but slot is not mentioned', () => {
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      }

      const result = store.slotHasError('123', 'height')
      expect(result).toBe(false)
    })

    it('should return true when slot has error', () => {
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      }

      const result = store.slotHasError('123', 'width')
      expect(result).toBe(true)
    })

    it('should return true when multiple errors exist for the same slot', () => {
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            },
            {
              type: 'validation_error',
              message: 'Invalid range',
              details: 'Width must be less than 1000',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      }

      const result = store.slotHasError('123', 'width')
      expect(result).toBe(true)
    })

    it('should handle errors without extra_info', () => {
      store.lastNodeErrors = {
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'General error',
              details: 'Something went wrong'
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      }

      const result = store.slotHasError('123', 'width')
      expect(result).toBe(false)
    })
  })
})

describe('useExecutionStore - executingNode with subgraphs', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useExecutionStore()
  })

  it('should find executing node in root graph', () => {
    const mockNode = {
      id: '123',
      title: 'Test Node',
      type: 'TestNode'
    } as LGraphNode

    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

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

    // Create a real subgraph with the test helper
    const testSubgraph = createTestSubgraph({
      id: 'sub-uuid'
    })
    // Add the mock node to the subgraph
    testSubgraph._nodes.push(mockNodeInSubgraph)

    // Create a subgraph node using the helper
    const mockSubgraphNode = createTestSubgraphNode(testSubgraph, {
      id: '456'
    })

    // Mock the subgraph's getNodeById to return our mock node
    vi.spyOn(testSubgraph, 'getNodeById').mockImplementation(
      (id: string | number | null | undefined) =>
        id === '789' ? mockNodeInSubgraph : null
    )

    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockSubgraphNode)

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
    store.nodeProgressStates = {}

    expect(store.executingNode).toBeNull()
  })

  it('should return null when executing node cannot be found', () => {
    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(null)

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
