/**
 * Node Event Handlers Composable
 *
 * Handles all Vue node interaction events including:
 * - Node selection with multi-select support
 * - Node collapse/expand state management
 * - Node title editing and updates
 * - Layout mutations for visual feedback
 * - Integration with LiteGraph canvas selection system
 */
import { createSharedComposable } from '@vueuse/core'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { isLGraphNode } from '@/utils/litegraphUtil'

/**
 * Check if multiple nodes are selected
 * Optimized to return early when 2+ nodes found
 */
function hasMultipleNodesSelected(selectedItems: unknown[]): boolean {
  let count = 0
  for (let i = 0; i < selectedItems.length; i++) {
    if (isLGraphNode(selectedItems[i])) {
      count++
      if (count >= 2) {
        return true
      }
    }
  }
  return false
}

function useNodeEventHandlersIndividual() {
  const canvasStore = useCanvasStore()
  const { nodeManager } = useVueNodeLifecycle()
  const { bringNodeToFront } = useNodeZIndex()
  const { shouldHandleNodePointerEvents } = useCanvasInteractions()

  /**
   * Handle node selection events
   * Supports single selection and multi-select with Ctrl/Cmd
   */
  const handleNodeSelect = (event: PointerEvent, nodeData: VueNodeData) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    const node = nodeManager.value.getNode(nodeData.id)
    if (!node) return

    const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey

    if (isMultiSelect) {
      // Ctrl/Cmd+click -> toggle selection
      if (node.selected) {
        canvasStore.canvas.deselect(node)
      } else {
        canvasStore.canvas.select(node)
      }
    } else {
      const selectedMultipleNodes = hasMultipleNodesSelected(
        canvasStore.selectedItems
      )
      if (!selectedMultipleNodes) {
        // Single-select the node
        canvasStore.canvas.deselectAll()
        canvasStore.canvas.select(node)
      }
    }

    // Bring node to front when clicked (similar to LiteGraph behavior)
    // Skip if node is pinned to avoid unwanted movement
    if (!node.flags?.pinned) {
      bringNodeToFront(nodeData.id)
    }

    // Update canvas selection tracking
    canvasStore.updateSelectedItems()
  }

  /**
   * Handle node collapse/expand state changes
   * Uses LiteGraph's native collapse method for proper state management
   */
  const handleNodeCollapse = (nodeId: string, collapsed: boolean) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!nodeManager.value) return

    const node = nodeManager.value.getNode(nodeId)
    if (!node) return

    // Use LiteGraph's collapse method if the state needs to change
    const currentCollapsed = node.flags?.collapsed ?? false
    if (currentCollapsed !== collapsed) {
      node.collapse()
    }
  }

  /**
   * Handle node title updates
   * Updates the title in LiteGraph for persistence across sessions
   */
  const handleNodeTitleUpdate = (nodeId: string, newTitle: string) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!nodeManager.value) return

    const node = nodeManager.value.getNode(nodeId)
    if (!node) return

    // Update the node title in LiteGraph for persistence
    node.title = newTitle
  }

  /**
   * Handle node double-click events
   * Can be used for custom actions like opening node editor
   */
  const handleNodeDoubleClick = (
    event: PointerEvent,
    nodeData: VueNodeData
  ) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    const node = nodeManager.value.getNode(nodeData.id)
    if (!node) return

    // Prevent default browser behavior
    event.preventDefault()

    // TODO: add custom double-click behavior here
    // For now, ensure node is selected
    if (!node.selected) {
      handleNodeSelect(event, nodeData)
    }
  }

  /**
   * Handle node right-click context menu events
   * Integrates with LiteGraph's context menu system
   */
  const handleNodeRightClick = (event: PointerEvent, nodeData: VueNodeData) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    const node = nodeManager.value.getNode(nodeData.id)
    if (!node) return

    // Prevent default context menu
    event.preventDefault()

    // Select the node if not already selected
    if (!node.selected) {
      handleNodeSelect(event, nodeData)
    }

    // Let LiteGraph handle the context menu
    // The canvas will handle showing the appropriate context menu
  }

  /**
   * Handle node drag start events
   * Prepares node for dragging and sets appropriate visual state
   */
  const handleNodeDragStart = (event: DragEvent, nodeData: VueNodeData) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    const node = nodeManager.value.getNode(nodeData.id)
    if (!node) return

    // Ensure node is selected before dragging
    if (!node.selected) {
      // Create a synthetic pointer event for selection
      const syntheticEvent = new PointerEvent('pointerdown', {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        bubbles: true
      })
      handleNodeSelect(syntheticEvent, nodeData)
    }

    // Set drag data for potential drop operations
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/comfy-node-id', nodeData.id)
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  /**
   * Batch select multiple nodes
   * Useful for selection toolbox or area selection
   */
  const selectNodes = (nodeIds: string[], addToSelection = false) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    if (!addToSelection) {
      canvasStore.canvas.deselectAll()
    }

    nodeIds.forEach((nodeId) => {
      const node = nodeManager.value?.getNode(nodeId)
      if (node && canvasStore.canvas) {
        canvasStore.canvas.select(node)
      }
    })

    canvasStore.updateSelectedItems()
  }

  /**
   * Deselect specific nodes
   */
  const deselectNodes = (nodeIds: string[]) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    nodeIds.forEach((nodeId) => {
      const node = nodeManager.value?.getNode(nodeId)
      if (node) {
        node.selected = false
      }
    })

    canvasStore.updateSelectedItems()
  }

  return {
    // Core event handlers
    handleNodeSelect,
    handleNodeCollapse,
    handleNodeTitleUpdate,
    handleNodeDoubleClick,
    handleNodeRightClick,
    handleNodeDragStart,

    // Batch operations
    selectNodes,
    deselectNodes
  }
}

export const useNodeEventHandlers = createSharedComposable(
  useNodeEventHandlersIndividual
)
