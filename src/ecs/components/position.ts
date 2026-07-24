/**
 * Position component — shared by Node, Reroute, and Group entities.
 *
 * Plain data object. No methods, no back-references.
 * Corresponds to the spatial data currently on LGraphNode.pos/size,
 * Reroute.pos, and LGraphGroup._bounding.
 *
 * During the bridge phase, this mirrors data from the LayoutStore
 * (Y.js CRDTs). See migration plan Phase 2a.
 */

import type { Point, Size } from '@/lib/litegraph/src/interfaces'

export interface Position {
  /** Position in graph coordinates (top-left for nodes/groups, center for reroutes). */
  pos: Point
  /** Width and height. Undefined for point-like entities (reroutes). */
  size?: Size
  /**
   * Bounding rectangle as [x, y, width, height].
   * May extend beyond pos/size (e.g., nodes with title overhang).
   */
  bounding: readonly [x: number, y: number, w: number, h: number]
}
