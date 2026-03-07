import type { LGraphNode, Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, Reroute } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { collectFromNodes } from '@/utils/graphTraversalUtil'

export function useSelectedLiteGraphItems() {
  const canvasStore = useCanvasStore()

  const isIgnoredItem = (item: Positionable): boolean => {
    return item instanceof Reroute
  }

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

  const getSelectableItems = (): Set<Positionable> => {
    const { selectedItems } = canvasStore.getCanvas()
    return filterSelectableItems(selectedItems)
  }

  const hasSelectableItems = (): boolean => {
    return getSelectableItems().size > 0
  }

  const hasMultipleSelectableItems = (): boolean => {
    return getSelectableItems().size > 1
  }

  /** Includes descendant nodes from any selected subgraphs. */
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
   * Toggle the execution mode of all selected nodes
   *
   * - If any nodes are not already the specified node mode → all are set to specified mode
   * - Otherwise → set all nodes to ALWAYS
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
