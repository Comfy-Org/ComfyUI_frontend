/**
 * Reroute components.
 *
 * Reroutes are waypoints on link paths. Position is shared via the
 * Position component. These components capture the link topology
 * and visual state specific to reroutes.
 */

import type { CanvasColour } from '@/lib/litegraph/src/interfaces'

import type { LinkEntityId, RerouteEntityId } from '../entityId'

/**
 * Link topology for a reroute.
 *
 * A reroute can be chained (parentId) and carries a set of links
 * that pass through it.
 */
export interface RerouteLinks {
  /** Parent reroute in the chain, if any. */
  parentId?: RerouteEntityId
  /** Links that pass through this reroute. */
  linkIds: ReadonlySet<LinkEntityId>
  /** Floating (in-progress) links passing through this reroute. */
  floatingLinkIds: ReadonlySet<LinkEntityId>
}

/** Visual state specific to reroute rendering. */
export interface RerouteVisual {
  color?: CanvasColour
  /** Cached path for the link segment. */
  path?: Path2D
  /** Angle at the reroute center (for directional rendering). */
  centerAngle?: number
}
