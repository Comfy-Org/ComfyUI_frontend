import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

/** Rendered height of a Vue node header; a collapsed node is exactly this tall. */
export const VUE_NODE_HEADER_HEIGHT = 28

/** A node's expanded slot anchors relative to `node.pos`. */
export interface DerivedSlotAnchors {
  input: ReadonlyMap<number, Point2D>
  output: ReadonlyMap<number, Point2D>
}
