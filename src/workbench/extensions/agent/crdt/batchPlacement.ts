interface PlacementOffset {
  dx: number
  dy: number
}

interface PlacementInput {
  existing: readonly PlacementRect[]
  viewport: PlacementRect | null
  incoming: readonly PlacementRect[]
}

export interface PlacementRect {
  x: number
  y: number
  width: number
  height: number
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

/**
 * One shared translation that moves a disconnected, offscreen batch of newly
 * inserted nodes beside the existing content's hull, or null when the batch
 * should keep the coordinates it arrived with. See ADR-CRDT-PLACEMENT-0035.
 */
export function placementOffset(input: PlacementInput): PlacementOffset | null {
  if (input.existing.length === 0 || input.incoming.length === 0) return null
  const anchor = hull(input.existing)
  const batch = hull(input.incoming)
  const inflated = {
    left: anchor.left - DISCONNECTED_GAP_PX,
    top: anchor.top - DISCONNECTED_GAP_PX,
    right: anchor.right + DISCONNECTED_GAP_PX,
    bottom: anchor.bottom + DISCONNECTED_GAP_PX
  }
  if (intersects(inflated, batch)) return null
  if (input.viewport && intersects(toBounds(input.viewport), batch)) return null
  return {
    dx: anchor.right + PLACEMENT_GUTTER_PX - batch.left,
    dy: anchor.top - batch.top
  }
}
