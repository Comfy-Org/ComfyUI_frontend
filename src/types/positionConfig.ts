import type { Point, Size } from '@/lib/litegraph/src/interfaces'

export interface PositionConfig {
  /* The position of the element on litegraph canvas */
  pos: Point
  /* The size of the element on litegraph canvas */
  size: Size
  /* The scale factor of the canvas */
  scale?: number
}
