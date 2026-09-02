/** Padding applied around the selection bounding rect (both screen + canvas). */
export const SELECTION_BOUNDS_PADDING = 10

/** Rectangle expressed in canvas-world coordinates. */
export interface CanvasRect {
  x: number
  y: number
  w: number
  h: number
}
