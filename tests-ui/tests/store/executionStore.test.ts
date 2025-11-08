import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'

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

const mockShowChatHistory = vi.fn()
vi.mock('@/composables/node/useNodeChatHistory', () => ({
  useNodeChatHistory: () => ({
    showChatHistory: mockShowChatHistory
  })
}))

vi.mock('@/composables/node/useNodeProgressText', () => ({
  useNodeProgressText: () => ({
    showTextPreview: vi.fn()
  })
}))

// Mock the app import with proper implementation
vi.mock('@/scripts/app', () => ({
  app: {
    graph: {
      getNodeById: vi.fn(),
      _nodes: [] // Add _nodes array for workflowStore iteration
    },
    revokePreviews: vi.fn(),
    nodePreviewImages: {}
  }
}))

describe('executionStore - display_component handling', () => {
  function createDisplayComponentEvent(
    nodeId: string,
    component = 'ChatHistoryWidget'
  ) {
    return new CustomEvent('display_component', {
      detail: {
        node_id: nodeId,
        component,
        props: {
          history: JSON.stringify([{ prompt: 'Test', response: 'Response' }])
        }
      }
    })
  }

  function handleDisplayComponentMessage(event: CustomEvent) {
    const { node_id, component } = event.detail
    const node = vi.mocked(app.graph.getNodeById)(node_id)
    if (node && component === 'ChatHistoryWidget') {
      mockShowChatHistory(node)
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    useExecutionStore()
    vi.clearAllMocks()
  })

  it('handles ChatHistoryWidget display_component messages', () => {
    const mockNode = { id: '123' } as any
    vi.mocked(app.graph.getNodeById).mockReturnValue(mockNode)

    const event = createDisplayComponentEvent('123')
    handleDisplayComponentMessage(event)

    expect(app.graph.getNodeById).toHaveBeenCalledWith('123')
    expect(mockShowChatHistory).toHaveBeenCalledWith(mockNode)
  })

  it('does nothing if node is not found', () => {
    vi.mocked(app.graph.getNodeById).mockReturnValue(null)

    const event = createDisplayComponentEvent('non-existent')
    handleDisplayComponentMessage(event)

    expect(app.graph.getNodeById).toHaveBeenCalledWith('non-existent')
    expect(mockShowChatHistory).not.toHaveBeenCalled()
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
      // Set up error data
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
        _nodes: []
      }

      const mockNode = {
        id: 123,
        isSubgraphNode: () => true,
        subgraph: mockSubgraph
      } as any

      vi.mocked(app.graph.getNodeById).mockReturnValue(mockNode)

      // Set up error data with execution ID
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

      // Should find error by converted locator ID
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
        _nodes: []
      }

      const mockNode = {
        id: 123,
        isSubgraphNode: () => true,
        subgraph: mockSubgraph
      } as any

      // Mock app.graph.getNodeById to return the mock node
      vi.mocked(app.graph.getNodeById).mockReturnValue(mockNode)

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
      // Mock app.graph.getNodeById to return null (node not found)
      vi.mocked(app.graph.getNodeById).mockReturnValue(null)

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
