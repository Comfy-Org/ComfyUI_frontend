import { tryOnScopeDispose } from '@vueuse/core'
import { shallowRef } from 'vue'

import { app } from '@/scripts/app'

/**
 * Composable for syncing shift key state from Vue pointer events to LiteGraph canvas.
 * This enables snap-to-grid preview rendering in LiteGraph when dragging/resizing Vue nodes.
 *
 * @returns Object containing trackShiftKey for automatic shift state synchronization
 */
export function useShiftKeySync() {
  const shiftKeyState = shallowRef(false)
  let canvasEl: HTMLCanvasElement | null = null

  /**
   * Syncs shift key state to LiteGraph canvas for snap-to-grid preview rendering
   */
  function syncShiftState(isShiftPressed: boolean) {
    if (isShiftPressed === shiftKeyState.value) return

    // Lazy-initialize canvas reference on first use
    if (!canvasEl) {
      canvasEl = app.canvas?.canvas ?? null
      if (!canvasEl) return // Canvas not ready yet
    }

    shiftKeyState.value = isShiftPressed
    canvasEl.dispatchEvent(
      new KeyboardEvent(isShiftPressed ? 'keydown' : 'keyup', {
        key: 'Shift',
        shiftKey: isShiftPressed,
        bubbles: true
      })
    )
  }

  /**
   * Track shift key state during drag/resize operations and sync to canvas.
   * Call at the start of pointer operations to enable continuous synchronization.
   *
   * @param initialEvent - The initial pointer event (pointerdown)
   * @returns Cleanup function to stop tracking - must be called when operation ends
   *
   * @example
   * ```ts
   * const stopTracking = trackShiftKey(event)
   * // ... drag/resize happens, shift state syncs automatically ...
   * stopTracking() // Call on pointerup
   * ```
   */
  function trackShiftKey(initialEvent: PointerEvent): () => void {
    // Sync initial shift state
    syncShiftState(initialEvent.shiftKey)

    // Listen for shift key press/release during the operation
    const handleKeyEvent = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return
      syncShiftState(e.shiftKey)
    }

    window.addEventListener('keydown', handleKeyEvent, { passive: true })
    window.addEventListener('keyup', handleKeyEvent, { passive: true })

    // Return cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyEvent)
      window.removeEventListener('keyup', handleKeyEvent)
    }
  }

  // Cleanup on component unmount
  tryOnScopeDispose(() => {
    shiftKeyState.value = false
    canvasEl = null
  })

  return { trackShiftKey }
}
