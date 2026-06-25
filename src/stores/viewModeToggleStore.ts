import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Shared, frame-lagged copy of the view mode that drives the toggle's segment
 * morph. The segments only animate when this value changes after they are on
 * screen, so lagging the real mode by two frames lets a freshly mounted toggle
 * render in the previous mode first and then animate into the new one. A
 * remount within the same mode reads the already-settled value and stays still.
 */
export const useViewModeToggleStore = defineStore('viewModeToggle', () => {
  const canvasStore = useCanvasStore()
  const displayLinearMode = ref(canvasStore.linearMode)

  watch(
    () => canvasStore.linearMode,
    (mode) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          displayLinearMode.value = mode
        })
      })
    }
  )

  return { displayLinearMode }
})
