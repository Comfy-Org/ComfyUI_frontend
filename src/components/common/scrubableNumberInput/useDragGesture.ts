import { useEventListener, usePointerLock } from '@vueuse/core'
import type { MaybeRef } from 'vue'
import { readonly, ref, unref } from 'vue'

type DragPointerType = 'mouse' | 'pen' | 'touch'

interface DragGestureOptions {
  /** Engage pointerLock for the duration of the drag. */
  lockPointer?: MaybeRef<boolean>
  disabled?: MaybeRef<boolean>
  /** Hold-to-drag delay in seconds. Set to 0 for instant drag. Default 0. */
  dragDelaySeconds?: number
  /** Pointer types accepted. Default mouse + pen + touch. */
  pointerType?: DragPointerType[]
  onDragStart?: (event: PointerEvent) => void
  /** dx/dy are in physical pixels with browser-zoom compensated out. */
  onDrag?: (dx: number, dy: number, event: PointerEvent) => void
  onDragEnd?: (event: PointerEvent) => void
  /** Fires when the pointer is released without ever crossing the drag threshold. */
  onClick?: (event: PointerEvent) => void
}

/**
 * DOM-only pointer wrangling. Hides ~100 lines of finicky pointer-event
 * choreography behind a 4-callback interface:
 *   - pointer capture so the drag survives leaving the element
 *   - optional pointer lock (for unbounded scrubbing)
 *   - drag-vs-click discrimination (timer + distance threshold)
 *   - pointercancel / pointerleave fallbacks so onDragEnd always fires
 *   - primary-button / pointer-type filtering
 *   - browser zoom compensation (event.movementX scaled by 1/zoom)
 *
 * Consumers receive dx/dy and don't need to know any of the above exists.
 */
export function useDragGesture(
  target: MaybeRef<HTMLElement | null | undefined>,
  options: DragGestureOptions = {}
): { dragging: Readonly<ReturnType<typeof ref<boolean>>> } {
  const dragging = ref(false)
  const allowedTypes = options.pointerType ?? ['mouse', 'pen', 'touch']
  const dragDelay = options.dragDelaySeconds ?? 0

  const { lock, unlock } = usePointerLock(target)

  let pointerId: number | null = null
  let pointerDownAt: [number, number] | null = null
  let dragDelayTimer: ReturnType<typeof setTimeout> | undefined
  let pointerLocked = false

  function teardown() {
    if (dragDelayTimer !== undefined) {
      clearTimeout(dragDelayTimer)
      dragDelayTimer = undefined
    }
    pointerDownAt = null
    pointerId = null
  }

  function fireStart(event: PointerEvent) {
    dragging.value = true
    if (unref(options.lockPointer) && !pointerLocked) {
      pointerLocked = true
      void lock(event).catch(() => {
        pointerLocked = false
      })
    }
    options.onDragStart?.(event)
  }

  function onPointerDown(event: PointerEvent) {
    if (unref(options.disabled)) return
    if (event.button !== 0 || !event.isPrimary) return
    if (!allowedTypes.includes(event.pointerType as DragPointerType)) return

    pointerId = event.pointerId
    pointerDownAt = [event.clientX, event.clientY]
    const el = unref(target)
    el?.setPointerCapture(pointerId)

    // Drag commitment is decided later — either by the movement-distance
    // threshold in onPointerMove, or by this long-press timer expiring while
    // the pointer is still down. Until then it's just a potential click.
    if (dragDelay === 0) return
    dragDelayTimer = setTimeout(() => fireStart(event), dragDelay * 1000)
  }

  function onPointerMove(event: PointerEvent) {
    if (pointerId !== event.pointerId || pointerDownAt === null) return

    if (!dragging.value) {
      // Lock engages inside fireStart, not yet — so clientX/Y is still valid
      // for the drag-vs-click distance threshold.
      const minDist = event.pointerType === 'mouse' ? 1 : 5
      const moved = Math.hypot(
        event.clientX - pointerDownAt[0],
        event.clientY - pointerDownAt[1]
      )
      if (moved < minDist) return
      if (dragDelayTimer !== undefined) {
        clearTimeout(dragDelayTimer)
        dragDelayTimer = undefined
      }
      fireStart(event)
    }

    // Compensate for browser zoom (Cmd +/-). event.movementX/Y report in
    // device-pixel-like units that don't honor the browser zoom level; the
    // ratio outerWidth/innerWidth backs that out.
    const browserZoom = window.outerWidth / window.innerWidth || 1
    const dx = (event.movementX || 0) / browserZoom
    const dy = (event.movementY || 0) / browserZoom
    options.onDrag?.(dx, dy, event)
  }

  function onPointerUp(event: PointerEvent) {
    if (pointerId !== event.pointerId) return
    const el = unref(target)
    el?.releasePointerCapture(event.pointerId)

    const wasDragging = dragging.value
    if (pointerLocked) {
      void unlock()
      pointerLocked = false
    }
    if (wasDragging) {
      options.onDragEnd?.(event)
    } else {
      options.onClick?.(event)
    }
    dragging.value = false
    teardown()
  }

  useEventListener(target, 'pointerdown', onPointerDown)
  useEventListener(target, 'pointermove', onPointerMove)
  useEventListener(target, 'pointerup', onPointerUp)
  useEventListener(target, 'pointercancel', onPointerUp)
  useEventListener(target, 'pointerleave', onPointerUp)

  return { dragging: readonly(dragging) }
}
