import { LGraphNode } from '@comfyorg/litegraph'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeChatHistory } from '@/composables/node/useNodeChatHistory'

vi.mock('@/composables/widgets/useChatHistoryWidget', () => ({
  useChatHistoryWidget: () => {
    return (node: any, inputSpec: any) => {
      const widget = {
        name: inputSpec.name,
        type: inputSpec.type
      }

      if (!node.widgets) {
        node.widgets = []
      }
      node.widgets.push(widget)

      return widget
    }
  }
}))

// Mock LGraphNode type
type MockNode = {
  widgets: Array<{ name: string; type: string }>
  setDirtyCanvas: ReturnType<typeof vi.fn>
  addCustomWidget: ReturnType<typeof vi.fn>
  [key: string]: any
}

describe('useNodeChatHistory', () => {
  const mockNode = {
    widgets: [],
    setDirtyCanvas: vi.fn(),
    addCustomWidget: vi.fn()
  } as unknown as LGraphNode & MockNode

  beforeEach(() => {
    mockNode.widgets = []
    mockNode.setDirtyCanvas.mockClear()
    mockNode.addCustomWidget.mockClear()
  })

  it('adds chat history widget to node', () => {
    const { showChatHistory } = useNodeChatHistory()
    showChatHistory(mockNode)

    expect(mockNode.widgets.length).toBe(1)
    expect(mockNode.widgets[0].name).toBe('$$node-chat-history')
    expect(mockNode.setDirtyCanvas).toHaveBeenCalled()
  })

  it('removes chat history widget from node', () => {
    const { showChatHistory, removeChatHistory } = useNodeChatHistory()
    showChatHistory(mockNode)

    expect(mockNode.widgets.length).toBe(1)

    removeChatHistory(mockNode)
    expect(mockNode.widgets.length).toBe(0)
  })
})
