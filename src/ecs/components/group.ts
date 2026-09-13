/**
 * Group components.
 *
 * Groups are visual containers that hold nodes and reroutes.
 * Currently no state has been extracted from LGraphGroup — these
 * components represent the full extraction target.
 */

import type { NodeEntityId, RerouteEntityId } from '../entityId'

/** Metadata for a group. */
export interface GroupMeta {
  title: string
  font?: string
  fontSize: number
}

/** Visual properties for group rendering. */
export interface GroupVisual {
  color?: string
}

/**
 * Entities contained within a group.
 *
 * Replaces LGraphGroup._children (Set<Positionable>) and
 * LGraphGroup._nodes (LGraphNode[]).
 */
export interface GroupChildren {
  nodeIds: ReadonlySet<NodeEntityId>
  rerouteIds: ReadonlySet<RerouteEntityId>
}
