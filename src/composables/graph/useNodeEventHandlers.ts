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
import type { Ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useCanvasStore } from '@/stores/graphStore'

interface NodeManager {
  getNode: (id: string) => any
}

export function useNodeEventHandlers(nodeManager: Ref<NodeManager | null>) {
  const canvasStore = useCanvasStore()
  const layoutMutations = useLayoutMutations()

  /**
   * Handle node selection events
   * Supports single selection and multi-select with Ctrl/Cmd
   */
  const handleNodeSelect = (event: PointerEvent, nodeData: VueNodeData) => {
    if (!canvasStore.canvas || !nodeManager.value) return

    const node = nodeManager.value.getNode(nodeData.id)
    if (!node) return

    // Handle multi-select with Ctrl/Cmd key
    if (!event.ctrlKey && !event.metaKey) {
      canvasStore.canvas.deselectAllNodes()
    }

    canvasStore.canvas.selectNode(node)

    // Bring node to front when clicked (similar to LiteGraph behavior)
    // Skip if node is pinned to avoid unwanted movement
    if (!node.flags?.pinned) {
      layoutMutations.setSource(LayoutSource.Vue)
      layoutMutations.bringNodeToFront(nodeData.id)
    }

    // Ensure node selection state is set
    node.selected = true

    // Update canvas selection tracking
    canvasStore.updateSelectedItems()
  }

  /**
   * Handle node collapse/expand state changes
   * Uses LiteGraph's native collapse method for proper state management
   */
  const handleNodeCollapse = (nodeId: string, collapsed: boolean) => {
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
    if (!canvasStore.canvas || !nodeManager.value) return

    if (!addToSelection) {
      canvasStore.canvas.deselectAllNodes()
    }

    nodeIds.forEach((nodeId) => {
      const node = nodeManager.value?.getNode(nodeId)
      if (node && canvasStore.canvas) {
        canvasStore.canvas.selectNode(node)
        node.selected = true
      }
    })

    canvasStore.updateSelectedItems()
  }

  /**
   * Deselect specific nodes
   */
  const deselectNodes = (nodeIds: string[]) => {
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
