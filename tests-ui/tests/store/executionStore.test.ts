import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useExecutionStore } from '@/stores/executionStore'

// Remove any previous global types
declare global {
  // Empty interface to override any previous declarations
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
