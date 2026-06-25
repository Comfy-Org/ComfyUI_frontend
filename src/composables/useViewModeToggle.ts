import { ref, watch } from 'vue';
import type { Ref } from 'vue';

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

let displayLinearMode: Ref<boolean> | undefined

/**
 * Frame-lagged copy of the view mode that drives the toggle's segment morph.
 * The segments only animate when this value changes after they are on screen,
 * so lagging the real mode by two frames lets a toggle that mounts during a
 * switch render in the previous mode first and then animate into the new one.
 *
 * The value is a module-level singleton so it survives the graph-mode toggle
 * unmounting and the app-mode toggle mounting in its place during a switch; a
 * remount within the same mode reads the already-settled value and stays still.
 */
export function useViewModeToggle() {
  if (!displayLinearMode) {
    const canvasStore = useCanvasStore()
    const mode = ref(canvasStore.linearMode)
    watch(
      () => canvasStore.linearMode,
      (next) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            mode.value = next
          })
        })
      }
    )
    displayLinearMode = mode
  }
  return { displayLinearMode }
}
