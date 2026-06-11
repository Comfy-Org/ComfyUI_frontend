import type { LGraphNode, Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, Reroute } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { collectFromNodes } from '@/utils/graphTraversalUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

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
   * The top-level selected nodes from the canonical selection set.
   * Shallow — does NOT expand subgraph children, unlike {@link getSelectedNodes}.
   * Mode toggles use this so they apply to the selected subgraph node, not its
   * descendants. Returns `[]` when the canvas is not yet available, preserving
   * the prior null-tolerance for callers wired to early-firing commands.
   */
  const getSelectedNodesShallow = (): LGraphNode[] =>
    Array.from(canvasStore.canvas?.selectedItems ?? []).filter(isLGraphNode)

  /**
   * Get only the selected nodes (LGraphNode instances) from the canvas.
   * This filters out other types of selected items like groups or reroutes.
   * If a selected node is a subgraph, this also includes all nodes within it.
   * @returns Array of selected LGraphNode instances and their descendants.
   */
  const getSelectedNodes = (): LGraphNode[] => {
    const nodeArray = getSelectedNodesShallow()

    const hasSubgraphs = nodeArray.some(
      (node) => node.isSubgraphNode?.() && node.subgraph
    )
    if (!hasSubgraphs) return nodeArray

    return collectFromNodes(nodeArray)
  }

  /**
   * True iff every selected node is in `mode`. Mirrors the predicate used by
   * {@link toggleSelectedNodesMode} so labels match the toggle's effect.
   * An empty selection returns `false` (no node is in the mode).
   */
  const areAllSelectedNodesInMode = (mode: LGraphEventMode): boolean => {
    const selectedNodeArray = getSelectedNodesShallow()
    return (
      selectedNodeArray.length > 0 &&
      selectedNodeArray.every((node) => node.mode === mode)
    )
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
    const selectedNodeArray = getSelectedNodesShallow()
    const newModeForSelectedNode = areAllSelectedNodesInMode(mode)
      ? LGraphEventMode.ALWAYS
      : mode

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
    areAllSelectedNodesInMode,
    toggleSelectedNodesMode
  }
}
