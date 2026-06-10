/**
 * Canonical node-id type and helpers.
 *
 * `NodeId` is the single source of truth for node identity across litegraph and
 * the app. It is a string at runtime; raw `number | string` values from legacy
 * workflows or external callers are normalised through {@link asNodeId} at the
 * boundary.
 */

import type {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'

export type NodeId = string & { readonly __brand: 'NodeId' }

/**
 * Raw values accepted at boundaries and legacy load points. Do not use for
 * stored/runtime node-id fields; normalise with {@link asNodeId} first.
 */
export type NodeIdInput = string | number

/**
 * A link endpoint id, which is either a real {@link NodeId} or one of the
 * numeric sentinels used by floating links (`-1`) and subgraph IO nodes.
 */
export type LinkEndpointNodeId =
  | NodeId
  | -1
  | typeof SUBGRAPH_INPUT_ID
  | typeof SUBGRAPH_OUTPUT_ID

/** Normalises a raw value into a {@link NodeId}. */
export function asNodeId(value: NodeIdInput): NodeId {
  return String(value) as NodeId
}

/**
 * Sentinel id for a node that has not yet been assigned a real id by a graph.
 * Stored as a string so that `node.id` is uniformly a string at runtime; the
 * legacy numeric `-1` is still tolerated by {@link isUnassignedNodeId}.
 */
export const UNASSIGNED_NODE_ID: NodeId = asNodeId('-1')

/**
 * Whether an id is missing or the unassigned sentinel. Accepts the legacy
 * numeric `-1` for backward compatibility with serialized data and callers
 * that have not yet migrated to string ids.
 */
export function isUnassignedNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id == null || id === -1 || id === UNASSIGNED_NODE_ID
}

/**
 * Whether an id is a counter-managed numeric id, i.e. a non-negative integer
 * (number) or a numeric-looking string (e.g. `"42"`). UUID ids and composite
 * group-node ids (e.g. `"10:3"`) return false, matching the legacy
 * `typeof id === 'number'` guards that excluded them from counter advancement.
 */
export function isNumericNodeId(id: NodeIdInput): boolean {
  return typeof id === 'number' ? Number.isInteger(id) : /^\d+$/.test(id)
}

/**
 * Numeric value of a numeric id, used to advance the `lastNodeId` counter.
 * Only meaningful when {@link isNumericNodeId} is true for the id.
 */
export function nodeIdToNumber(id: NodeIdInput): number {
  return typeof id === 'number' ? id : Number(id)
}
