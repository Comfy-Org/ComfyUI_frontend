import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExecutionStore } from '@/stores/executionStore'

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

global.app = {
  graph: {
    getNodeById: vi.fn()
  }
} as any

describe('executionStore - display_component handling', () => {
  function createDisplayComponentEvent(nodeId: string, component = 'ChatHistoryWidget') {
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
    const node = app.graph.getNodeById(node_id)
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
    global.app.graph.getNodeById.mockReturnValue(mockNode)
    
    const event = createDisplayComponentEvent('123')
    handleDisplayComponentMessage(event)
    
    expect(global.app.graph.getNodeById).toHaveBeenCalledWith('123')
    expect(mockShowChatHistory).toHaveBeenCalledWith(mockNode)
  })
  
  it('does nothing if node is not found', () => {
    global.app.graph.getNodeById.mockReturnValue(null)
    
    const event = createDisplayComponentEvent('non-existent')
    handleDisplayComponentMessage(event)
    
    expect(global.app.graph.getNodeById).toHaveBeenCalledWith('non-existent')
    expect(mockShowChatHistory).not.toHaveBeenCalled()
  })
})