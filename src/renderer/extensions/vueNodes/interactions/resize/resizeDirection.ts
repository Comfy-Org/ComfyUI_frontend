import type { CompassCorners } from '@comfyorg/shared-frontend-utils/geometry'

/** A corner or edge a resize handle drags. */
export type ResizeDirection = CompassCorners | 'N' | 'E' | 'S' | 'W'

type AxisSign = -1 | 0 | 1

/** The corners of a Vue node that carry resize handles. */
export const NODE_RESIZE_CORNERS: readonly CompassCorners[] = [
  'SE',
  'NE',
  'SW',
  'NW'
]

/** Which way dragging `direction` moves each edge: -1 for west or north, 1 for east or south, 0 for an axis it leaves alone. */
export function resizeAxes(direction: ResizeDirection): {
  x: AxisSign
  y: AxisSign
} {
  return {
    x: direction.includes('W') ? -1 : direction.includes('E') ? 1 : 0,
    y: direction.includes('N') ? -1 : direction.includes('S') ? 1 : 0
  }
}

/** Whether `direction` is a corner rather than a single edge. */
export function isCorner(
  direction: ResizeDirection
): direction is CompassCorners {
  return direction.length === 2
}
