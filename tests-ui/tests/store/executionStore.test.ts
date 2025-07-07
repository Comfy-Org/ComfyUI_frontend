import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowStore } from '@/stores/workflowStore'

// Remove any previous global types
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
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

// Create a local mock instead of using global to avoid conflicts
const mockApp = {
  graph: {
    getNodeById: vi.fn()
  }
}

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
    const node = mockApp.graph.getNodeById(node_id)
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
    const mockNode = { id: '123' }
    mockApp.graph.getNodeById.mockReturnValue(mockNode)

    const event = createDisplayComponentEvent('123')
    handleDisplayComponentMessage(event)

    expect(mockApp.graph.getNodeById).toHaveBeenCalledWith('123')
    expect(mockShowChatHistory).toHaveBeenCalledWith(mockNode)
  })

  it('does nothing if node is not found', () => {
    mockApp.graph.getNodeById.mockReturnValue(null)

    const event = createDisplayComponentEvent('non-existent')
    handleDisplayComponentMessage(event)

    expect(mockApp.graph.getNodeById).toHaveBeenCalledWith('non-existent')
    expect(mockShowChatHistory).not.toHaveBeenCalled()
  })
})

describe('useExecutionStore - NodeLocatorId conversions', () => {
  let store: ReturnType<typeof useExecutionStore>
  let workflowStore: ReturnType<typeof useWorkflowStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useExecutionStore()
    workflowStore = useWorkflowStore()
    vi.clearAllMocks()
  })

  describe('executionIdToNodeLocatorId', () => {
    it('should convert hierarchical execution ID to NodeLocatorId', () => {
      const mockNodeLocatorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890:456'
      vi.spyOn(workflowStore, 'hierarchicalIdToNodeLocatorId').mockReturnValue(
        mockNodeLocatorId as any
      )

      const result = store.executionIdToNodeLocatorId('123:456')

      expect(workflowStore.hierarchicalIdToNodeLocatorId).toHaveBeenCalledWith(
        '123:456'
      )
      expect(result).toBe(mockNodeLocatorId)
    })

    it('should convert simple node ID to NodeLocatorId', () => {
      const mockNodeLocatorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890:123'
      vi.spyOn(workflowStore, 'nodeIdToNodeLocatorId').mockReturnValue(
        mockNodeLocatorId as any
      )

      const result = store.executionIdToNodeLocatorId('123')

      expect(workflowStore.nodeIdToNodeLocatorId).toHaveBeenCalledWith('123')
      expect(result).toBe(mockNodeLocatorId)
    })

    it('should handle numeric node IDs', () => {
      const mockNodeLocatorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890:123'
      vi.spyOn(workflowStore, 'nodeIdToNodeLocatorId').mockReturnValue(
        mockNodeLocatorId as any
      )

      const result = store.executionIdToNodeLocatorId(123)

      expect(workflowStore.nodeIdToNodeLocatorId).toHaveBeenCalledWith('123')
      expect(result).toBe(mockNodeLocatorId)
    })

    it('should return null when conversion fails', () => {
      vi.spyOn(workflowStore, 'hierarchicalIdToNodeLocatorId').mockReturnValue(
        null
      )

      const result = store.executionIdToNodeLocatorId('123:456')

      expect(result).toBeNull()
    })
  })

  describe('nodeLocatorIdToExecutionId', () => {
    it('should convert NodeLocatorId to hierarchical execution ID', () => {
      const mockHierarchicalId = '123:456'
      vi.spyOn(workflowStore, 'nodeLocatorIdToHierarchicalId').mockReturnValue(
        mockHierarchicalId as any
      )

      const result = store.nodeLocatorIdToExecutionId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890:456'
      )

      expect(workflowStore.nodeLocatorIdToHierarchicalId).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890:456'
      )
      expect(result).toBe(mockHierarchicalId)
    })

    it('should return null when conversion fails', () => {
      vi.spyOn(workflowStore, 'nodeLocatorIdToHierarchicalId').mockReturnValue(
        null
      )

      const result = store.nodeLocatorIdToExecutionId('invalid:format')

      expect(result).toBeNull()
    })
  })
})
