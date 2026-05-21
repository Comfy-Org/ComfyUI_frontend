/**
 * Shared pan + zoom handlers for the App Mode workspace and the App
 * Builder backdrop. Both reuse the same `appModeStore.panBy` and
 * `appModeStore.zoomAt` calls; the differences (whether to gate the
 * start on event-target containment, whether to abandon on window
 * blur) are configurable per consumer.
 */
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { watch } from 'vue'
import type { Ref } from 'vue'

import { useAppModeStore } from '@/stores/appModeStore'

interface UseWorkspacePanZoomOptions {
  /**
   * The element pointer-capture is set on; also used to read the
   * bounding rect for `zoomAt`. Both consumers want capture to live
   * on the visible workspace surface, not on `window`.
   */
  surfaceRef: Ref<HTMLElement | null>
  /**
   * Optional gate: receives the pointerdown/wheel event target and
   * returns true to handle, false to bubble. Lets the App Mode
   * workspace let the floating panel scroll through it.
   */
  shouldHandle?: (target: EventTarget | null) => boolean
  /**
   * Abandon the drag if the window loses focus. Useful when the
   * pointerup is likely to land outside the page (alt-tab during
   * drag).
   */
  abandonOnBlur?: boolean
}

interface UseWorkspacePanZoomReturn {
  handleWheel: (e: WheelEvent) => void
  handlePointerDown: (e: PointerEvent) => void
}

// 5px threshold guards against swallowing clicks on in-workspace
// controls before a real drag intent has been demonstrated.
const DRAG_THRESHOLD_PX = 5

export function useWorkspacePanZoom(
  options: UseWorkspacePanZoomOptions
): UseWorkspacePanZoomReturn {
  const { surfaceRef, shouldHandle, abandonOnBlur = false } = options
  const appModeStore = useAppModeStore()

  let dragStart: { x: number; y: number; pointerId: number } | null = null
  let dragging = false

  function handleWheel(e: WheelEvent) {
    if (shouldHandle && !shouldHandle(e.target)) return
    const el = surfaceRef.value
    if (!el) return
    e.preventDefault()
    appModeStore.zoomAt(
      e.clientX,
      e.clientY,
      e.deltaY,
      el.getBoundingClientRect()
    )
  }

  function handlePointerDown(e: PointerEvent) {
    // Re-entrance guard — a second pointerdown during an active drag
    // (multi-touch, second mouse button) would overwrite dragStart
    // and leak the prior pointer-capture session.
    if (dragStart !== null) return
    if (e.button !== 0 && e.button !== 1) return
    if (shouldHandle && !shouldHandle(e.target)) return
    dragStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId }
  }

  // Window-level so a drag leaving the surface keeps tracking.
  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (!dragStart) return
    if (!dragging) {
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
      try {
        surfaceRef.value?.setPointerCapture(dragStart.pointerId)
      } catch {
        // Some browsers reject capture on non-primary pointers.
      }
      dragging = true
    }
    appModeStore.panBy(e.movementX, e.movementY)
  })

  function endDrag() {
    if (dragStart && dragging) {
      try {
        surfaceRef.value?.releasePointerCapture(dragStart.pointerId)
      } catch {
        // pointer may already be released
      }
    }
    dragStart = null
    dragging = false
  }
  useEventListener(window, 'pointerup', endDrag)
  useEventListener(window, 'pointercancel', endDrag)

  if (abandonOnBlur) {
    // Abandon on blur — pointerup may never arrive after alt-tab.
    const focused = useWindowFocus()
    watch(focused, (nowFocused) => {
      if (!nowFocused && dragStart !== null) endDrag()
    })
  }

  return { handleWheel, handlePointerDown }
}
