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

import type { NodeDataBase } from '@/composables/graph/useGraphNodeManager'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useNodeZIndex } from '@/renderer/extensions/vueNodes/composables/useNodeZIndex'
import { isMultiSelectKey } from '@/renderer/extensions/vueNodes/utils/selectionUtils'

function useNodeEventHandlersIndividual() {
  const canvasStore = useCanvasStore()
  const { nodeManager } = useVueNodeLifecycle()
  const { bringNodeToFront } = useNodeZIndex()
  const { shouldHandleNodePointerEvents } = useCanvasInteractions()

  /**
   * Handle node selection events
   * Supports single selection and multi-select with Ctrl/Cmd
   */
  const handleNodeSelect = (event: PointerEvent, nodeData: NodeDataBase) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    const node = nodeManager.value.getNode(nodeData.id)
    if (!node) return

    const multiSelect = isMultiSelectKey(event)
    const selectedItemsCount = canvasStore.selectedItems.length
    const preserveExistingSelection =
      !multiSelect && node.selected && selectedItemsCount > 1

    if (multiSelect) {
      if (!node.selected) {
        canvasStore.canvas.select(node)
      }
    } else if (!preserveExistingSelection) {
      // Regular click -> single select
      canvasStore.canvas.deselectAll()
      canvasStore.canvas.select(node)
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
    nodeData: NodeDataBase
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
  const handleNodeRightClick = (
    event: PointerEvent,
    nodeData: NodeDataBase
  ) => {
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
  const handleNodeDragStart = (event: DragEvent, nodeData: NodeDataBase) => {
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
   * Ensure node is selected for shift-drag operations
   * Handles special logic for promoting a node to selection when shift-dragging
   * @param event - The pointer event (for multi-select key detection)
   * @param nodeData - The node data for the node being dragged
   * @param wasSelectedAtPointerDown - Whether the node was selected when pointer-down occurred
   */
  const ensureNodeSelectedForShiftDrag = (
    event: PointerEvent,
    nodeData: NodeDataBase,
    wasSelectedAtPointerDown: boolean
  ) => {
    if (wasSelectedAtPointerDown) return

    const multiSelectKeyPressed = isMultiSelectKey(event)
    if (!multiSelectKeyPressed) return

    if (!canvasStore.canvas || !nodeManager.value) return
    const node = nodeManager.value.getNode(nodeData.id)
    if (!node || node.selected) return

    const selectionCount = canvasStore.selectedItems.length
    const addToSelection = selectionCount > 0
    selectNodes([nodeData.id], addToSelection)
  }

  const toggleNodeSelectionAfterPointerUp = (
    nodeId: string,
    {
      wasSelectedAtPointerDown,
      multiSelect
    }: {
      wasSelectedAtPointerDown: boolean
      multiSelect: boolean
    }
  ) => {
    if (!shouldHandleNodePointerEvents.value) return

    if (!canvasStore.canvas || !nodeManager.value) return

    const node = nodeManager.value.getNode(nodeId)
    if (!node) return

    if (!multiSelect) {
      const multipleSelected = canvasStore.selectedItems.length > 1
      if (multipleSelected && wasSelectedAtPointerDown) {
        canvasStore.canvas.deselectAll()
        canvasStore.canvas.select(node)
        canvasStore.updateSelectedItems()
      }
      return
    }

    if (wasSelectedAtPointerDown) {
      canvasStore.canvas.deselect(node)
      canvasStore.updateSelectedItems()
    }

    // No action needed when the node was not previously selected since the pointer-down
    // handler already added it to the selection.
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
    ensureNodeSelectedForShiftDrag,
    toggleNodeSelectionAfterPointerUp
  }
}

export const useNodeEventHandlers = createSharedComposable(
  useNodeEventHandlersIndividual
)
