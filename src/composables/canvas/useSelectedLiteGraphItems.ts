import { Positionable, Reroute } from '@comfyorg/litegraph'

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

  return {
    isIgnoredItem,
    filterSelectableItems,
    getSelectableItems,
    hasSelectableItems,
    hasMultipleSelectableItems
  }
}
