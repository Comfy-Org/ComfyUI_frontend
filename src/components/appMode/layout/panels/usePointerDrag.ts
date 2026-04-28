/**
 * Shared pointer-drag lifecycle: pointer-id tracking, threshold gate,
 * setPointerCapture, pointerup/cancel reset, blur abandon. Consumers
 * wire `onMove` / `onCommit` and own their own snapshot state.
 */
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

interface UsePointerDragOptions {
  /** Pixels of movement before `isDragging` flips true. 0 = immediate. */
  threshold?: number
  stopPropagation?: boolean
  /** Return false to abort (e.g. wrong button). */
  onStart?: (e: PointerEvent) => boolean | void
  onMove: (e: PointerEvent) => void
  onActivate?: () => void
  onCommit?: (e: PointerEvent) => void
  /** Cleanup hook — fires on commit, cancel, and blur. */
  onReset?: () => void
}

interface UsePointerDragResult {
  isDragging: Ref<boolean>
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
    // Re-entrance guard — prevents leaked pointer capture.
    if (activePointerId !== null) return
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

  // Abandon on blur so a drag doesn't survive alt-tab / OS modals.
  const focused = useWindowFocus()
  watch(focused, (nowFocused) => {
    if (!nowFocused && activePointerId !== null) reset()
  })

  return { isDragging, start }
}
