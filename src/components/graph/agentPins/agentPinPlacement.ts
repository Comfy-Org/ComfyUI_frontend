/** A box in screen px. */
export interface PinBox {
  left: number
  top: number
  width: number
  height: number
}

/** A point in screen px. */
export interface ScreenPoint {
  x: number
  y: number
}

/** Where a pin of `size` goes for a node whose top-right corner is at `corner`: just past it, `gap` px right and above. */
export function pinBoxAt(corner: ScreenPoint, size: number, gap = 4): PinBox {
  return {
    left: corner.x + gap,
    top: corner.y - gap - size,
    width: size,
    height: size
  }
}

function distanceToBox(box: PinBox, point: ScreenPoint): number {
  const dx = Math.max(box.left - point.x, 0, point.x - (box.left + box.width))
  const dy = Math.max(box.top - point.y, 0, point.y - (box.top + box.height))
  return Math.hypot(dx, dy)
}

/** Moves a pin up in `step` px, at most `maxSteps` times, until no socket is within `keepOut` px. */
export function clearOfSockets(
  box: PinBox,
  sockets: readonly ScreenPoint[],
  { keepOut = 24, step = 8, maxSteps = 3 } = {}
): PinBox {
  let placed = box
  for (let i = 0; i < maxSteps; i++) {
    const nearest = Math.min(
      ...sockets.map((socket) => distanceToBox(placed, socket))
    )
    if (nearest >= keepOut) return placed
    placed = { ...placed, top: placed.top - step }
  }
  return placed
}
