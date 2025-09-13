import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCanvasStore } from '@/stores/graphStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

/**
 * Centralized computed selection state + shared helper actions to avoid duplication
 * between selection toolbox, context menus, and other UI affordances.
 */
export function useSelectionState() {
  const canvasStore = useCanvasStore()
  const { selectedItems } = storeToRefs(canvasStore)

  const selectedNodes = computed(() => {
    return selectedItems.value.filter((i) => isLGraphNode(i))
  })

  const hasAnySelection = computed(() => selectedItems.value.length > 0)
  const isDeletable = computed(() =>
    selectedItems.value.some((x) => x.removable)
  )
  return {
    selectedItems,
    selectedNodes,
    hasAnySelection,
    isDeletable
  }
}
