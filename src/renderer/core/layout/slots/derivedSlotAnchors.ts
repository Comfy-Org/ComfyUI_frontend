import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

/** A node's expanded slot anchors relative to `node.pos`. */
export interface DerivedSlotAnchors {
  input: ReadonlyMap<number, Point2D>
  output: ReadonlyMap<number, Point2D>
}
