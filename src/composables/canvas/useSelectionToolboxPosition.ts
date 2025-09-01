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
// Shared signals for auxiliary UI (e.g., MoreOptions) to coordinate hide/restore
export const moreOptionsOpen = ref(false)
// Emitted (counter increment) when a drag starts and more options was open; component should hide popover.
export const forceCloseMoreOptionsSignal = ref(0)
// Emitted (counter increment) after drag ends & selection toolbox reappears and previous more options wanted restore.
export const restoreMoreOptionsSignal = ref(0)
// Indicates a previous open MoreOptions should be restored after drag completes
export const moreOptionsRestorePending = ref(false)
// For debugging / ensuring we don't restore stale sessions
export const moreOptionsRestoreSession = ref(0)

let moreOptionsWasOpenBeforeDrag = false

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
        if (moreOptionsOpen.value) {
          // Signal MoreOptions to close itself but remember to restore later.
          moreOptionsWasOpenBeforeDrag = true
          moreOptionsOpen.value = false
          moreOptionsRestorePending.value = true
          moreOptionsRestoreSession.value++
          forceCloseMoreOptionsSignal.value++
        } else {
          moreOptionsRestorePending.value = false
          moreOptionsWasOpenBeforeDrag = false
        }
      } else {
        // Update after dragging ends
        requestAnimationFrame(() => {
          updateSelectionBounds()
          // Restore more options if it was open before drag and selection toolbox is visible again
          if (
            moreOptionsWasOpenBeforeDrag &&
            visible.value &&
            moreOptionsRestorePending.value
          ) {
            restoreMoreOptionsSignal.value++
          } else {
            // No restore happened; clear pending if any.
            moreOptionsRestorePending.value = false
          }
          moreOptionsWasOpenBeforeDrag = false
        })
      }
    }
  )

  return {
    visible
  }
}
