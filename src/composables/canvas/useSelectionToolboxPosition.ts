import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useCanvasTransformSync } from '@/composables/canvas/useCanvasTransformSync'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { createBounds } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'

/**
 * Manages the position of the selection toolbox independently.
 * Uses CSS custom properties for performant transform updates.
 */
export function useSelectionToolboxPosition(
  toolboxRef: Ref<HTMLElement | undefined>
) {
  const canvasStore = useCanvasStore()
  const lgCanvas = canvasStore.getCanvas()
  const { getSelectableItems } = useSelectedLiteGraphItems()

  // World position of selection center
  const worldPosition = ref({ x: 0, y: 0 })

  const visible = ref(false)

  /**
   * Update position based on selection
   */
  const updateSelectionBounds = () => {
    const selectableItems = getSelectableItems()

    if (!selectableItems.size) {
      visible.value = false
      return
    }

    visible.value = true
    const bounds = createBounds(selectableItems)

    if (!bounds) {
      return
    }

    const [xBase, y, width] = bounds

    worldPosition.value = {
      x: xBase + width / 2,
      y: y
    }

    updateTransform()
  }

  const updateTransform = () => {
    if (!visible.value) return

    const { scale, offset } = lgCanvas.ds
    const canvasRect = lgCanvas.canvas.getBoundingClientRect()

    const screenX =
      (worldPosition.value.x + offset[0]) * scale + canvasRect.left
    const screenY = (worldPosition.value.y + offset[1]) * scale + canvasRect.top

    // Update CSS custom properties directly for best performance
    if (toolboxRef.value) {
      toolboxRef.value.style.setProperty('--tb-x', `${screenX}px`)
      toolboxRef.value.style.setProperty('--tb-y', `${screenY}px`)
    }
  }

  // Sync with canvas transform
  const { startSync, stopSync } = useCanvasTransformSync(updateTransform, {
    autoStart: false
  })

  // Watch for selection changes
  watch(
    () => canvasStore.getCanvas().state.selectionChanged,
    (changed) => {
      if (changed) {
        updateSelectionBounds()
        canvasStore.getCanvas().state.selectionChanged = false

        // Start transform sync if we have selection
        if (visible.value) {
          startSync()
        } else {
          stopSync()
        }
      }
    },
    { immediate: true }
  )

  // Watch for dragging state
  watch(
    () => canvasStore.canvas?.state?.draggingItems,
    (dragging) => {
      if (dragging) {
        // Hide during node dragging
        visible.value = false
      } else {
        // Update after dragging ends
        requestAnimationFrame(() => {
          updateSelectionBounds()
        })
      }
    }
  )

  return {
    visible
  }
}
