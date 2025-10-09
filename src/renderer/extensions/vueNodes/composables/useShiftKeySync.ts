import { onScopeDispose, shallowRef } from 'vue'

import { app } from '@/scripts/app'

/**
 * Composable for syncing shift key state from Vue pointer events to LiteGraph canvas.
 * This enables snap-to-grid preview rendering in LiteGraph when dragging/resizing Vue nodes.
 *
 * @returns Object containing the syncShiftKeyToCanvas function
 */
export function useShiftKeySync() {
  const shiftKeyState = shallowRef(false)
  let canvasEl: HTMLCanvasElement | null = null

  /**
   * Syncs shift key state from Vue pointer events to LiteGraph canvas
   * for snap-to-grid preview rendering
   */
  function syncShiftKeyToCanvas(event: PointerEvent) {
    if (event.shiftKey === shiftKeyState.value) return

    // Lazy-initialize canvas reference on first use
    if (!canvasEl) {
      canvasEl = app.canvas?.canvas ?? null
      if (!canvasEl) return // Canvas not ready yet
    }

    shiftKeyState.value = event.shiftKey
    canvasEl.dispatchEvent(
      new KeyboardEvent(event.shiftKey ? 'keydown' : 'keyup', {
        key: 'Shift',
        shiftKey: event.shiftKey,
        bubbles: true
      })
    )
  }

  // Cleanup on component unmount
  onScopeDispose(() => {
    shiftKeyState.value = false
    canvasEl = null
  })

  return { syncShiftKeyToCanvas }
}
