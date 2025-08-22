import { ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

import { useCanvasTransformSync } from '@/composables/canvas/useCanvasTransformSync'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { createBounds } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'

/**
 * Manages the position of the selection toolbox independently.
 * Uses transform for all positioning to avoid layout.
 */
export function useSelectionToolboxPosition() {
  const canvasStore = useCanvasStore()
  const lgCanvas = canvasStore.getCanvas()
  const { getSelectableItems } = useSelectedLiteGraphItems()

  // World position of selection center
  const worldPosition = ref({ x: 0, y: 0, width: 0, height: 0 })

  const visible = ref(false)

  const style = ref<CSSProperties>({})

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

    worldPosition.value = {
      x: bounds[0] + bounds[2] / 2,
      y: bounds[1],
      width: bounds[2],
      height: bounds[3]
    }

    updateTransform()
  }

  const updateTransform = () => {
    if (!visible.value) return

    const { scale, offset } = lgCanvas.ds
    const canvasRect = lgCanvas.canvas.getBoundingClientRect()

    // Transform world to screen coordinates
    // Position toolbox at top-center of selection
    const screenX =
      (worldPosition.value.x + offset[0]) * scale + canvasRect.left
    const screenY = (worldPosition.value.y + offset[1]) * scale + canvasRect.top

    // Position the toolbox above the selection bounds
    // The -50% centers it horizontally,
    const toolboxOffset = 45

    style.value = {
      transform: `translate(${screenX}px, ${screenY - toolboxOffset}px) translateX(-50%)`
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
        style.value = {
          ...style.value,
          visibility: 'hidden'
        }
      } else if (visible.value) {
        // Show after dragging ends
        requestAnimationFrame(() => {
          updateSelectionBounds()
        })
      }
    }
  )

  return {
    style,
    visible,
    updateSelectionBounds
  }
}
