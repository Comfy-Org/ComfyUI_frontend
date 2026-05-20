import type { LGraphNode, Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, Reroute } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { collectFromNodes } from '@/utils/graphTraversalUtil'

/**
 * Composable for handling selected LiteGraph items filtering and operations.
 * This provides utilities for working with selected items on the canvas,
 * including filtering out items that should not be included in selection operations.
 */
export function useSelectedLiteGraphItems() {
  const canvasStore = useCanvasStore()

  /**
   * Items that should not show in the selection overlay are ignored.
   * @param item - The item to check.
   * @returns True if the item should be ignored, false otherwise.
   */
  function isIgnoredItem(item: Positionable): boolean {
    return item instanceof Reroute
  }

  /**
   * Filter out items that should not show in the selection overlay.
   * @param items - The Set of items to filter.
   * @returns The filtered Set of items.
   */
  function filterSelectableItems(items: Set<Positionable>): Set<Positionable> {
    const result = new Set<Positionable>()
    for (const item of items) {
      if (!isIgnoredItem(item)) {
        result.add(item)
      }
    }
    return result
  }

  /**
   * Get the filtered selected items from the canvas.
   * @returns The filtered Set of selected items.
   */
  function getSelectableItems(): Set<Positionable> {
    const { selectedItems } = canvasStore.getCanvas()
    return filterSelectableItems(selectedItems)
  }

  /**
   * Check if there are any selectable items.
   * @returns True if there are selectable items, false otherwise.
   */
  function hasSelectableItems(): boolean {
    return getSelectableItems().size > 0
  }

  /**
   * Check if there are multiple selectable items.
   * @returns True if there are multiple selectable items, false otherwise.
   */
  function hasMultipleSelectableItems(): boolean {
    return getSelectableItems().size > 1
  }

  /**
   * Get only the selected nodes (LGraphNode instances) from the canvas.
   * This filters out other types of selected items like groups or reroutes.
   * If a selected node is a subgraph, this also includes all nodes within it.
   * @returns Array of selected LGraphNode instances and their descendants.
   */
  function getSelectedNodes(): LGraphNode[] {
    const selectedNodes = app.canvas.selected_nodes
    if (!selectedNodes) return []

    // Convert selected_nodes object to array, preserving order
    const nodeArray: LGraphNode[] = []
    for (const i in selectedNodes) {
      nodeArray.push(selectedNodes[i])
    }

    // Check if any selected nodes are subgraphs
    const hasSubgraphs = nodeArray.some(
      (node) => node.isSubgraphNode?.() && node.subgraph
    )

    // If no subgraphs, just return the array directly to preserve order
    if (!hasSubgraphs) {
      return nodeArray
    }

    // Use collectFromNodes to get all nodes including those in subgraphs
    return collectFromNodes(nodeArray)
  }

  /**
   * Toggle the execution mode of all selected nodes
   *
   * - If any nodes are not already the specified node mode → all are set to specified mode
   * - Otherwise → set all nodes to ALWAYS
   *
   * @param mode - The LGraphEventMode to toggle to (e.g., NEVER for mute, BYPASS for bypass)
   */
  function toggleSelectedNodesMode(mode: LGraphEventMode): void {
    const selectedNodes = app.canvas.selected_nodes
    if (!selectedNodes) return

    // Convert selected_nodes object to array
    const selectedNodeArray: LGraphNode[] = []
    for (const i in selectedNodes) {
      selectedNodeArray.push(selectedNodes[i])
    }
    const allNodesMatch = !selectedNodeArray.some(
      (selectedNode) => selectedNode.mode !== mode
    )
    const newModeForSelectedNode = allNodesMatch ? LGraphEventMode.ALWAYS : mode

    for (const selectedNode of selectedNodeArray)
      selectedNode.mode = newModeForSelectedNode
  }

  return {
    isIgnoredItem,
    filterSelectableItems,
    getSelectableItems,
    hasSelectableItems,
    hasMultipleSelectableItems,
    getSelectedNodes,
    toggleSelectedNodesMode
  }
}
