import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'

export type NodeId = string & { readonly __brand: 'NodeId' }

/** Raw value at boundaries/legacy load points; normalise with `asNodeId`. */
export type NodeIdInput = string | number

/**
 * @deprecated Use `NodeId`. Link endpoints are branded `NodeId` strings both at
 * runtime and on the wire; numeric sentinels are only tolerated as legacy input
 * via `asNodeId` and the tolerant predicates below. Retained as a compatibility
 * alias for external consumers.
 */
export type LinkEndpointNodeId = NodeId

export function asNodeId(value: NodeIdInput): NodeId {
  return String(value) as NodeId
}

/** Sentinel for a node not yet assigned a real id by a graph. */
export const UNASSIGNED_NODE_ID: NodeId = asNodeId('-1')

/** Branded floating-link endpoint sentinel (no node on this side). */
export const FLOATING_LINK_NODE_ID: NodeId = asNodeId('-1')

/** Branded sentinel for the virtual subgraph input node. */
export const SUBGRAPH_INPUT_NODE_ID: NodeId = asNodeId(SUBGRAPH_INPUT_ID)

/** Branded sentinel for the virtual subgraph output node. */
export const SUBGRAPH_OUTPUT_NODE_ID: NodeId = asNodeId(SUBGRAPH_OUTPUT_ID)

/** Tolerates legacy numeric `-1` from serialized data. */
export function isUnassignedNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id == null || id === -1 || id === UNASSIGNED_NODE_ID
}

/** Floating-link endpoint. Tolerates legacy numeric `-1`. */
export function isFloatingNodeId(id: NodeIdInput | null | undefined): boolean {
  return id == null || id === -1 || id === FLOATING_LINK_NODE_ID
}

/** Subgraph input boundary endpoint. Tolerates legacy numeric `-10`. */
export function isSubgraphInputNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id === SUBGRAPH_INPUT_ID || id === SUBGRAPH_INPUT_NODE_ID
}

/** Subgraph output boundary endpoint. Tolerates legacy numeric `-20`. */
export function isSubgraphOutputNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id === SUBGRAPH_OUTPUT_ID || id === SUBGRAPH_OUTPUT_NODE_ID
}

/**
 * Counter-managed numeric id.
 * UUIDs,
 * composite ids (`"10:3"`),
 * and negative sentinels (`-1`, `-10`, `-20`) are false.
 */
export function isNumericNodeId(id: NodeIdInput): boolean {
  return typeof id === 'number'
    ? Number.isInteger(id) && id >= 0
    : /^\d+$/.test(id)
}

export function nodeIdToNumber(id: NodeIdInput): number {
  const value = typeof id === 'number' ? id : Number(id)
  if (!Number.isInteger(value)) {
    throw new TypeError(`Invalid numeric node id: ${String(id)}`)
  }
  return value
}
