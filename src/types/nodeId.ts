import type {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'

export type NodeId = string & { readonly __brand: 'NodeId' }

/** Raw value at boundaries/legacy load points; normalise with `asNodeId`. */
export type NodeIdInput = string | number

/** A `NodeId` or a numeric sentinel (floating links `-1`, subgraph IO nodes). */
export type LinkEndpointNodeId =
  | NodeId
  | -1
  | typeof SUBGRAPH_INPUT_ID
  | typeof SUBGRAPH_OUTPUT_ID

export function asNodeId(value: NodeIdInput): NodeId {
  return String(value) as NodeId
}

/** Sentinel for a node not yet assigned a real id by a graph. */
export const UNASSIGNED_NODE_ID: NodeId = asNodeId('-1')

/** Tolerates legacy numeric `-1` from serialized data. */
export function isUnassignedNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id == null || id === -1 || id === UNASSIGNED_NODE_ID
}

/** Counter-managed numeric id. UUIDs and composite ids (`"10:3"`) are false. */
export function isNumericNodeId(id: NodeIdInput): boolean {
  return typeof id === 'number' ? Number.isInteger(id) : /^\d+$/.test(id)
}

export function nodeIdToNumber(id: NodeIdInput): number {
  return typeof id === 'number' ? id : Number(id)
}
