import { LGraphNode } from '@comfyorg/litegraph'

import type ChatHistoryWidget from '@/components/graph/widgets/ChatHistoryWidget.vue'
import { useChatHistoryWidget } from '@/composables/widgets/useChatHistoryWidget'

const CHAT_HISTORY_WIDGET_NAME = '$$node-chat-history'

/**
 * Composable for handling node text previews
 */
export function useNodeChatHistory(
  options: {
    minHeight?: number
    props?: Omit<InstanceType<typeof ChatHistoryWidget>['$props'], 'widget'>
  } = {}
) {
  const chatHistoryWidget = useChatHistoryWidget(options)

  const addChatHistoryWidget = (node: LGraphNode) =>
    chatHistoryWidget(node, {
      name: CHAT_HISTORY_WIDGET_NAME,
      type: 'chatHistory'
    })

  /**
   * Shows chat history for a node
   * @param node The graph node to show the chat history for
   */
  function showChatHistory(node: LGraphNode) {
    // First remove any existing widget
    removeChatHistory(node)

    // Then add the widget with new history
    addChatHistoryWidget(node)
    node.setDirtyCanvas?.(true)
  }

  /**
   * Removes chat history from a node
   * @param node The graph node to remove the chat history from
   */
  function removeChatHistory(node: LGraphNode) {
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === CHAT_HISTORY_WIDGET_NAME
    )

    if (widgetIdx > -1) {
      node.widgets[widgetIdx].onRemove?.()
      node.widgets.splice(widgetIdx, 1)
    }
  }

  return {
    showChatHistory,
    removeChatHistory
  }
}
