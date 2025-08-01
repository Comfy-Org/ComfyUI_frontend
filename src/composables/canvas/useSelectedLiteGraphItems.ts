import {
  LGraphEventMode,
  LGraphNode,
  Positionable,
  Reroute
} from '@comfyorg/litegraph'

import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'

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
   * @returns Array of selected LGraphNode instances.
   */
  const getSelectedNodes = (): LGraphNode[] => {
    const selectedNodes = app.canvas.selected_nodes
    const result: LGraphNode[] = []
    if (selectedNodes) {
      for (const i in selectedNodes) {
        const node = selectedNodes[i]
        result.push(node)
      }
    }
    return result
  }

  /**
   * Toggle the execution mode of all selected nodes.
   * If a node is already in the specified mode, it will be set to ALWAYS.
   * Otherwise, it will be set to the specified mode.
   * @param mode - The LGraphEventMode to toggle to.
   */
  const toggleSelectedNodesMode = (mode: LGraphEventMode): void => {
    getSelectedNodes().forEach((node) => {
      if (node.mode === mode) {
        node.mode = LGraphEventMode.ALWAYS
      } else {
        node.mode = mode
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
