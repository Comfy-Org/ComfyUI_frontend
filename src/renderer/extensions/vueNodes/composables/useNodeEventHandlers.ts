/**
 * Node Event Handlers Composable
 *
 * Handles Vue node interaction events including:
 * - Node collapse/expand state management
 * - Node title editing and updates
 * - Right-click selection ahead of the context menu
 */
import { createSharedComposable } from '@vueuse/core'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import type { NodeId } from '@/types/nodeId'

function useNodeEventHandlersIndividual() {
  const canvasStore = useCanvasStore()
  const { shouldHandleNodePointerEvents } = useCanvasInteractions()

  function getNode(nodeId: NodeId) {
    return canvasStore.currentGraph?.getNodeById(nodeId) ?? undefined
  }

  /**
   * Handle node collapse/expand state changes
   * Uses LiteGraph's native collapse method for proper state management
   */
  function handleNodeCollapse(nodeId: NodeId, collapsed: boolean) {
    if (!shouldHandleNodePointerEvents.value) return

    const node = getNode(nodeId)
    if (!node) return

    // Use LiteGraph's collapse method if the state needs to change
    const currentCollapsed = node.flags.collapsed ?? false
    if (currentCollapsed !== collapsed) {
      node.collapse()
    }
  }

  /**
   * Handle node title updates
   * Updates the title in LiteGraph for persistence across sessions
   */
  function handleNodeTitleUpdate(nodeId: NodeId, newTitle: string) {
    if (!shouldHandleNodePointerEvents.value) return

    const node = getNode(nodeId)
    if (!node) return

    // Update the node title in LiteGraph for persistence
    node.title = newTitle

    // If this is a subgraph node, sync the subgraph name for breadcrumb reactivity
    if (node.isSubgraphNode()) {
      node.subgraph.name = newTitle
    }
  }

  /**
   * Handle node right-click context menu events
   * Integrates with LiteGraph's context menu system
   */
  function handleNodeRightClick(event: PointerEvent, nodeId: NodeId) {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas) return

    const node = getNode(nodeId)
    if (!node) return

    event.preventDefault()

    canvasStore.canvas.processSelect(node, event, true)
  }

  return {
    handleNodeCollapse,
    handleNodeTitleUpdate,
    handleNodeRightClick
  }
}

export const useNodeEventHandlers = createSharedComposable(
  useNodeEventHandlersIndividual
)
