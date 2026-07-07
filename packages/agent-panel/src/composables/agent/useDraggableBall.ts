import { useDraggable, useStorage, useWindowSize } from '@vueuse/core'

import type { MaybeRefOrGetter } from 'vue'

const BALL_SIZE = 56
const MARGIN = 8
const TAP_THRESHOLD_PX = 5

export interface UseDraggableBallOptions {
  storageKey?: string
  // Fired on a tap (pointer moved < 5px), distinguishing a click-to-open from a drag.
  onTap?: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Drag the minimized ball around the viewport with a persisted position, a tap-vs-drag
 * discrimination (5px), and clamp-to-viewport on release so it can never be dragged
 * off-screen. Mirrors the monolith's ball drag behavior.
 */
export function useDraggableBall(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: UseDraggableBallOptions = {}
) {
  const { width, height } = useWindowSize()
  const stored = useStorage(options.storageKey ?? 'Comfy.AgentPanel.ballPos', {
    x: MARGIN,
    y: MARGIN
  })

  // A persisted position from a larger window must be clamped to the current viewport, or
  // the ball restores off-screen and is unreachable (clamp otherwise only runs on drag-end).
  const initialValue = {
    x: clamp(
      stored.value.x,
      MARGIN,
      Math.max(MARGIN, width.value - BALL_SIZE - MARGIN)
    ),
    y: clamp(
      stored.value.y,
      MARGIN,
      Math.max(MARGIN, height.value - BALL_SIZE - MARGIN)
    )
  }

  let startX = 0
  let startY = 0
  let moved = false

  // Tap-vs-drag is measured in POINTER coordinates (event.clientX/Y) across start and move.
  // useDraggable's onStart position is an offset within the element while onMove/onEnd give
  // the element's viewport position, so mixing them misclassifies every tap as a drag.
  const { x, y, style, isDragging } = useDraggable(target, {
    initialValue,
    preventDefault: true,
    onStart: (_position, event) => {
      startX = event.clientX
      startY = event.clientY
      moved = false
    },
    onMove: (_position, event) => {
      if (
        Math.hypot(event.clientX - startX, event.clientY - startY) >
        TAP_THRESHOLD_PX
      ) {
        moved = true
      }
    },
    onEnd: (position) => {
      const nextX = clamp(
        position.x,
        MARGIN,
        Math.max(MARGIN, width.value - BALL_SIZE - MARGIN)
      )
      const nextY = clamp(
        position.y,
        MARGIN,
        Math.max(MARGIN, height.value - BALL_SIZE - MARGIN)
      )
      x.value = nextX
      y.value = nextY
      stored.value = { x: nextX, y: nextY }
      if (!moved) options.onTap?.()
    }
  })

  return { x, y, style, isDragging }
}
