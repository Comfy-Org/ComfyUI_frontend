import {
  LGraphEventMode,
  LGraphNode,
  Positionable,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import {
  collectFromNodes,
  traverseNodesDepthFirst
} from '@/utils/graphTraversalUtil'

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
  const isIgnoredItem = (item: Positionable): boolean => {
    return item instanceof Reroute
  }

  /**
   * Filter out items that should not show in the selection overlay.
   * @param items - The Set of items to filter.
   * @returns The filtered Set of items.
   */
  const filterSelectableItems = (
    items: Set<Positionable>
  ): Set<Positionable> => {
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
  const getSelectableItems = (): Set<Positionable> => {
    const { selectedItems } = canvasStore.getCanvas()
    return filterSelectableItems(selectedItems)
  }

  /**
   * Check if there are any selectable items.
   * @returns True if there are selectable items, false otherwise.
   */
  const hasSelectableItems = (): boolean => {
    return getSelectableItems().size > 0
  }

  /**
   * Check if there are multiple selectable items.
   * @returns True if there are multiple selectable items, false otherwise.
   */
  const hasMultipleSelectableItems = (): boolean => {
    return getSelectableItems().size > 1
  }

  /**
   * Get only the selected nodes (LGraphNode instances) from the canvas.
   * This filters out other types of selected items like groups or reroutes.
   * If a selected node is a subgraph, this also includes all nodes within it.
   * @returns Array of selected LGraphNode instances and their descendants.
   */
  const getSelectedNodes = (): LGraphNode[] => {
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
   * Toggle the execution mode of all selected nodes with unified subgraph behavior.
   *
   * Top-level behavior (selected nodes): Standard toggle logic
   * - If the selected node is already in the specified mode → set to ALWAYS
   * - Otherwise → set to the specified mode
   *
   * Subgraph behavior (children of selected subgraph nodes): Unified state application
   * - All children inherit the same mode that their parent subgraph node was set to
   * - This creates predictable behavior: if you toggle a subgraph to "mute",
   *   ALL nodes inside become muted, regardless of their previous individual states
   *
   * @param mode - The LGraphEventMode to toggle to (e.g., NEVER for mute, BYPASS for bypass)
   */
  const toggleSelectedNodesMode = (mode: LGraphEventMode): void => {
    const selectedNodes = app.canvas.selected_nodes
    if (!selectedNodes) return

    // Convert selected_nodes object to array
    const selectedNodeArray: LGraphNode[] = []
    for (const i in selectedNodes) {
      selectedNodeArray.push(selectedNodes[i])
    }

    // Process each selected node independently to determine its target state and apply to children
    selectedNodeArray.forEach((selectedNode) => {
      // Apply standard toggle logic to the selected node itself
      const newModeForSelectedNode =
        selectedNode.mode === mode ? LGraphEventMode.ALWAYS : mode

      selectedNode.mode = newModeForSelectedNode

      // If this selected node is a subgraph, apply the same mode uniformly to all its children
      // This ensures predictable behavior: all children get the same state as their parent
      if (selectedNode.isSubgraphNode?.() && selectedNode.subgraph) {
        traverseNodesDepthFirst([selectedNode], {
          visitor: (node) => {
            // Skip the parent node since we already handled it above
            if (node === selectedNode) return undefined

            // Apply the parent's new mode to all children uniformly
            node.mode = newModeForSelectedNode
            return undefined
          }
        })
      }
    })
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
