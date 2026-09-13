/**
 * Link components.
 *
 * Decomposes LLink into endpoint topology, visual state, and
 * transient interaction state.
 */

import type {
  CanvasColour,
  ISlotType,
  Point
} from '@/lib/litegraph/src/interfaces'

import type { NodeEntityId, RerouteEntityId } from '../entityId'

/**
 * The topological endpoints of a link.
 *
 * Replaces origin_id/origin_slot/target_id/target_slot/type on LLink.
 * Slot indices will migrate to SlotEntityId references once slots
 * have independent IDs.
 */
export interface LinkEndpoints {
  originNodeId: NodeEntityId
  originSlotIndex: number
  targetNodeId: NodeEntityId
  targetSlotIndex: number
  /** Data type flowing through this link (e.g., 'IMAGE', 'MODEL'). */
  type: ISlotType
  /** Reroute that owns this link segment, if any. */
  parentRerouteId?: RerouteEntityId
}

/** Visual properties for link rendering. */
export interface LinkVisual {
  color?: CanvasColour
  /** Cached rendered path (invalidated on position change). */
  path?: Path2D
  /** Cached center point of the link curve. */
  centerPos?: Point
  /** Cached angle at the center point. */
  centerAngle?: number
}

/** Transient interaction state for a link. */
export interface LinkState {
  /** True while the user is dragging this link. */
  dragging: boolean
  /** Arbitrary data payload flowing through the link. */
  data?: unknown
}
