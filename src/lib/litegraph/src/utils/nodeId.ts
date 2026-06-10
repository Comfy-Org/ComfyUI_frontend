import type { NodeId } from '../LGraphNode'

/**
 * Sentinel id for a node that has not yet been assigned a real id by a graph.
 * Stored as a string so that `node.id` is uniformly a string at runtime; the
 * legacy numeric `-1` is still tolerated by {@link isUnassignedNodeId}.
 */
export const UNASSIGNED_NODE_ID = '-1'

/**
 * Whether an id is missing or the unassigned sentinel. Accepts the legacy
 * numeric `-1` for backward compatibility with serialized data and callers
 * that have not yet migrated to string ids.
 */
export function isUnassignedNodeId(id: NodeId | null | undefined): boolean {
  return id == null || id === -1 || id === UNASSIGNED_NODE_ID
}

/**
 * Whether an id is a counter-managed numeric id, i.e. a non-negative integer
 * (number) or a numeric-looking string (e.g. `"42"`). UUID ids and composite
 * group-node ids (e.g. `"10:3"`) return false, matching the legacy
 * `typeof id === 'number'` guards that excluded them from counter advancement.
 */
export function isNumericNodeId(id: NodeId): boolean {
  return typeof id === 'number' ? Number.isInteger(id) : /^\d+$/.test(id)
}

/**
 * Numeric value of a numeric id, used to advance the `lastNodeId` counter.
 * Only meaningful when {@link isNumericNodeId} is true for the id.
 */
export function nodeIdToNumber(id: NodeId): number {
  return typeof id === 'number' ? id : Number(id)
}
