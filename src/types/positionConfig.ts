import type { Size, Vector2 } from '@/lib/litegraph/src/litegraph'

export interface PositionConfig {
  /* The position of the element on litegraph canvas */
  pos: Vector2
  /* The size of the element on litegraph canvas */
  size: Size
  /* The scale factor of the canvas */
  scale?: number
}
