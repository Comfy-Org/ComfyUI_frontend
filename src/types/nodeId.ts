import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'

export type NodeId = number & { readonly __brand: 'NodeId' }

/** Raw value at boundaries/legacy load points; normalise with `asNodeId`. */
export type NodeIdInput = string | number

const DECIMAL_INTEGER = /^-?\d+$/

/** The only negative ids that are valid node ids: not-yet-assigned + the two
 * virtual subgraph boundary nodes. */
const VALID_NEGATIVE_NODE_IDS = new Set<number>([
  -1,
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
])

/**
 * Normalise a boundary value to a numeric `NodeId`. Accepts the legacy decimal
 * strings persisted in older workflows (e.g. `"5"`, `"-1"`) and rejects values
 * that are not decimal integers — empty strings, decimals, `1e3`, `0x10`,
 * UUIDs, and colon-separated execution/locator addresses (`"10:3"`). Those are
 * not entity ids; use `asNodeExecutionId` / `asNodeLocatorId` instead.
 */
export function asNodeId(value: NodeIdInput): NodeId {
  if (typeof value === 'string' && !DECIMAL_INTEGER.test(value)) {
    throw new TypeError(`Invalid NodeId (expected integer): ${value}`)
  }

  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(numeric)) {
    throw new TypeError(`Invalid NodeId (expected integer): ${String(value)}`)
  }

  if (numeric < 0 && !VALID_NEGATIVE_NODE_IDS.has(numeric)) {
    throw new TypeError(`Invalid NodeId sentinel: ${String(value)}`)
  }

  return numeric as NodeId
}

/**
 * Sentinel for a node not yet assigned a real id by a graph. Also used for a
 * floating link's unbound endpoint, which is definitionally not assigned to a
 * node.
 */
export const UNASSIGNED_NODE_ID: NodeId = asNodeId(-1)

/** Branded sentinel for the virtual subgraph input node. */
export const SUBGRAPH_INPUT_NODE_ID: NodeId = asNodeId(SUBGRAPH_INPUT_ID)

/** Branded sentinel for the virtual subgraph output node. */
export const SUBGRAPH_OUTPUT_NODE_ID: NodeId = asNodeId(SUBGRAPH_OUTPUT_ID)

/** Tolerates legacy numeric/string `-1` from serialized data. */
export function isUnassignedNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id == null || id === -1 || id === '-1'
}

/** Floating-link endpoint: an unbound side carries the unassigned sentinel. */
export function isFloatingNodeId(id: NodeIdInput | null | undefined): boolean {
  return isUnassignedNodeId(id)
}

/** Subgraph input boundary endpoint. Tolerates legacy numeric/string `-10`. */
export function isSubgraphInputNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id === SUBGRAPH_INPUT_ID || id === String(SUBGRAPH_INPUT_ID)
}

/** Subgraph output boundary endpoint. Tolerates legacy numeric/string `-20`. */
export function isSubgraphOutputNodeId(
  id: NodeIdInput | null | undefined
): boolean {
  return id === SUBGRAPH_OUTPUT_ID || id === String(SUBGRAPH_OUTPUT_ID)
}

/**
 * Counter-managed numeric id.
 * Negative sentinels (`-1`, `-10`, `-20`) are false.
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
