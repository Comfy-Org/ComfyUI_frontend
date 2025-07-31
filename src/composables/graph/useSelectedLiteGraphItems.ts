import { Positionable, Reroute } from '@comfyorg/litegraph'
import { ComputedRef, computed } from 'vue'

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
   * Get the raw selected items from the canvas.
   * Note: This returns the store's reactive array which is updated via updateSelectedItems().
   */
  const selectedItems: ComputedRef<Positionable[]> = computed(() => {
    return canvasStore.selectedItems
  })

  /**
   * Get the filtered selected items that should be included in selection operations.
   */
  const selectableItems: ComputedRef<Set<Positionable>> = computed(() => {
    return filterSelectableItems(new Set(selectedItems.value))
  })

  /**
   * Check if there are any selectable items.
   */
  const hasSelectableItems: ComputedRef<boolean> = computed(() => {
    return selectableItems.value.size > 0
  })

  /**
   * Check if there are multiple selectable items.
   */
  const hasMultipleSelectableItems: ComputedRef<boolean> = computed(() => {
    return selectableItems.value.size > 1
  })

  return {
    isIgnoredItem,
    filterSelectableItems,
    selectedItems,
    selectableItems,
    hasSelectableItems,
    hasMultipleSelectableItems
  }
}
