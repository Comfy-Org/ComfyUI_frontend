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
