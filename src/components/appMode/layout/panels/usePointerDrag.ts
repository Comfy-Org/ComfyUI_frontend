/**
 * Pointer-drag scaffolding shared by every drag/pan/resize handler in
 * App Mode (panel snap-drag, block reorder, panel resize, output-window
 * drag, workspace pan). Owns:
 *
 * - active-pointer tracking (so a stray second touch can't hijack)
 * - threshold gate (a click never counts as a drag)
 * - `setPointerCapture` / `releasePointerCapture` lifecycle
 * - pointerup / pointercancel reset
 * - window-blur abandon (alt-tab, OS modal) so a drag can't get stuck
 *
 * Consumers wire `onMove` / `onCommit` and keep their own snapshot or
 * computed-target state — this hook only orchestrates the lifecycle.
 */
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

interface UsePointerDragOptions {
  /** Pixel movement past pointerdown before `isDragging` flips true.
   *  0 (default) activates immediately on press. */
  threshold?: number
  /** Stop pointerdown propagation. Set when nested inside a parent
   *  with its own drag/pan handler. */
  stopPropagation?: boolean
  /** Optional gate. Return false to skip the drag (e.g. wrong button). */
  onStart?: (e: PointerEvent) => boolean | void
  /** Called on every pointermove past the threshold. */
  onMove: (e: PointerEvent) => void
  /** Called once when `isDragging` flips true. */
  onActivate?: () => void
  /** Called on pointerup if `isDragging` was true. */
  onCommit?: (e: PointerEvent) => void
  /** Called on pointerup, pointercancel, or blur — for cleanup of
   *  consumer-side state regardless of whether a drag actually
   *  activated. */
  onReset?: () => void
}

interface UsePointerDragResult {
  isDragging: Ref<boolean>
  /** Bind to the drag target's `@pointerdown`. */
  start: (e: PointerEvent) => void
}

export function usePointerDrag(
  opts: UsePointerDragOptions
): UsePointerDragResult {
  const isDragging = ref(false)
  const threshold = opts.threshold ?? 0
  const thresholdSq = threshold * threshold

  let activePointerId: number | null = null
  let capturedEl: HTMLElement | null = null
  let startX = 0
  let startY = 0

  const isOurs = (e: PointerEvent) =>
    activePointerId !== null && e.pointerId === activePointerId

  function reset() {
    isDragging.value = false
    if (capturedEl && activePointerId !== null) {
      try {
        capturedEl.releasePointerCapture(activePointerId)
      } catch {
        // pointer may already be released
      }
    }
    activePointerId = null
    capturedEl = null
    opts.onReset?.()
  }

  function activate() {
    if (isDragging.value) return
    isDragging.value = true
    opts.onActivate?.()
  }

  function start(e: PointerEvent): void {
    if (opts.onStart?.(e) === false) return
    activePointerId = e.pointerId
    capturedEl = e.currentTarget as HTMLElement
    startX = e.clientX
    startY = e.clientY
    try {
      capturedEl.setPointerCapture(e.pointerId)
    } catch {
      // some browsers reject capture on non-primary pointers
    }
    e.preventDefault()
    if (opts.stopPropagation) e.stopPropagation()
    if (threshold === 0) activate()
  }

  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (!isOurs(e)) return
    if (!isDragging.value) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (dx * dx + dy * dy < thresholdSq) return
      activate()
    }
    opts.onMove(e)
  })

  useEventListener(window, 'pointerup', (e: PointerEvent) => {
    if (!isOurs(e)) return
    if (isDragging.value) opts.onCommit?.(e)
    reset()
  })

  useEventListener(window, 'pointercancel', (e: PointerEvent) => {
    if (!isOurs(e)) return
    reset()
  })

  // Abandon on window blur so a drag can't survive alt-tab / OS modals.
  const focused = useWindowFocus()
  watch(focused, (nowFocused) => {
    if (!nowFocused && activePointerId !== null) reset()
  })

  return { isDragging, start }
}
