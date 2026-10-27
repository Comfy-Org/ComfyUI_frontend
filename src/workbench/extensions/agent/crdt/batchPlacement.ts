export interface PlacementRect {
  x: number
  y: number
  width: number
  height: number
}

interface PlacementOffset {
  dx: number
  dy: number
}

interface PlacementInput {
  existing: readonly PlacementRect[]
  viewport: PlacementRect | null
  incoming: readonly PlacementRect[]
  moveCollisions?: boolean
}

export const DISCONNECTED_GAP_PX = 600
export const PLACEMENT_GUTTER_PX = 80

interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

function toBounds(rect: PlacementRect): Bounds {
  return {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height
  }
}

function hull(rects: readonly PlacementRect[]): Bounds {
  return rects.map(toBounds).reduce((a, b) => ({
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom)
  }))
}

function intersects(a: Bounds, b: Bounds): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  )
}

function collides(
  existing: readonly PlacementRect[],
  incoming: readonly PlacementRect[]
): boolean {
  const existingBounds = existing.map(toBounds)
  return incoming.some((rect) => {
    const bounds = toBounds(rect)
    return existingBounds.some((other) => intersects(bounds, other))
  })
}

/** Returns a batch translation, or null when its coordinates stay unchanged. */
export function placementOffset(input: PlacementInput): PlacementOffset | null {
  if (input.existing.length === 0 || input.incoming.length === 0) return null
  const anchor = hull(input.existing)
  const batch = hull(input.incoming)
  const offset = {
    dx: anchor.right + PLACEMENT_GUTTER_PX - batch.left,
    dy: anchor.top - batch.top
  }
  if (input.moveCollisions && collides(input.existing, input.incoming))
    return offset
  const inflated = {
    left: anchor.left - DISCONNECTED_GAP_PX,
    top: anchor.top - DISCONNECTED_GAP_PX,
    right: anchor.right + DISCONNECTED_GAP_PX,
    bottom: anchor.bottom + DISCONNECTED_GAP_PX
  }
  if (intersects(inflated, batch)) return null
  if (input.viewport && intersects(toBounds(input.viewport), batch)) return null
  return offset
}
