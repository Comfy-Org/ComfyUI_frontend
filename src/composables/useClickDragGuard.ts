interface PointerPosition {
  readonly x: number
  readonly y: number
}

function squaredDistance(a: PointerPosition, b: PointerPosition): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function exceedsClickThreshold(
  start: PointerPosition,
  end: PointerPosition,
  threshold: number
): boolean {
  return squaredDistance(start, end) > threshold * threshold
}

export function useClickDragGuard(threshold: number = 5) {
  let start: PointerPosition | null = null

  function recordStart(e: { clientX: number; clientY: number }) {
    start = { x: e.clientX, y: e.clientY }
  }

  function wasDragged(e: { clientX: number; clientY: number }): boolean {
    if (!start) return false
    return exceedsClickThreshold(
      start,
      { x: e.clientX, y: e.clientY },
      threshold
    )
  }

  function reset() {
    start = null
  }

  return { recordStart, wasDragged, reset }
}
