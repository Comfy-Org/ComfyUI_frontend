import { parseNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A globally unique identifier for nodes that maintains consistency across
 * multiple instances of the same subgraph.
 *
 * Format:
 * - For subgraph nodes: `<immediate-contained-subgraph-uuid>:<local-node-id>`
 * - For root graph nodes: `<local-node-id>`
 *
 * Examples:
 * - "a1b2c3d4-e5f6-7890-abcd-ef1234567890:123" (node in subgraph)
 * - "456" (node in root graph)
 *
 * Unlike execution IDs which change based on the instance path,
 * NodeLocatorId remains the same for all instances of a particular node.
 */
export type NodeLocatorId = string & { readonly __brand: 'NodeLocatorId' }

/**
 * An execution identifier representing a node's position in nested subgraphs.
 * Also known as ExecutionId in some contexts.
 *
 * Format: Colon-separated path of node IDs
 * Example: "123:456:789" (node 789 in subgraph 456 in subgraph 123)
 */
export type NodeExecutionId = string & { readonly __brand: 'NodeExecutionId' }

function requireNodeIdSegment(value: unknown): NodeId | null {
  const nodeId = parseNodeId(value)
  if (!nodeId || nodeId.includes(':')) return null
  return nodeId
}

function parseNodeIdSegments(values: readonly unknown[]): NodeId[] | null {
  const nodeIds = values.map(requireNodeIdSegment)
  return nodeIds.every((nodeId): nodeId is NodeId => nodeId !== null)
    ? nodeIds
    : null
}

function nodeExecutionIdFromString(value: string): NodeExecutionId | null {
  return parseNodeIdSegments(value.split(':'))
    ? (value as NodeExecutionId)
    : null
}

/**
 * Type guard to check if a value is a NodeLocatorId
 */
export function isNodeLocatorId(value: unknown): value is NodeLocatorId {
  return typeof value === 'string' && parseNodeLocatorId(value) !== null
}

/**
 * Type guard to check if a value is a NodeExecutionId
 */
export function isNodeExecutionId(value: unknown): value is NodeExecutionId {
  return typeof value === 'string' && nodeExecutionIdFromString(value) !== null
}

/**
 * Parse a NodeLocatorId into its components
 * @param id The NodeLocatorId to parse
 * @returns The subgraph UUID and local node ID, or null if invalid
 */
export function parseNodeLocatorId(
  id: string
): { subgraphUuid: string | null; localNodeId: NodeId } | null {
  const parts = id.split(':')

  if (parts.length === 1) {
    const localNodeId = requireNodeIdSegment(id)
    if (!localNodeId) return null

    return { subgraphUuid: null, localNodeId }
  }

  if (parts.length !== 2) return null

  const [subgraphUuid, localNodeIdPart] = parts
  if (!UUID_PATTERN.test(subgraphUuid)) return null

  const localNodeId = requireNodeIdSegment(localNodeIdPart)
  if (!localNodeId) return null

  return { subgraphUuid, localNodeId }
}

/**
 * Create a NodeLocatorId from components
 * @param subgraphUuid The UUID of the immediate containing subgraph
 * @param localNodeId The local node ID within that subgraph
 * @returns A properly formatted NodeLocatorId
 */
export function createNodeLocatorId(
  subgraphUuid: string | null,
  localNodeId: NodeId
): NodeLocatorId
export function createNodeLocatorId(
  subgraphUuid: string | null,
  localNodeId: NodeId
): NodeLocatorId | null {
  const nodeId = requireNodeIdSegment(localNodeId)
  if (!nodeId) return null
  if (subgraphUuid && !UUID_PATTERN.test(subgraphUuid)) return null

  if (!subgraphUuid) return String(nodeId) as NodeLocatorId

  return `${subgraphUuid}:${nodeId}` as NodeLocatorId
}

/**
 * Create a locator while preserving an `insert_workflow` node's colon-bearing
 * local ID in either graph scope.
 */
export function createLeafNodeLocatorId(
  subgraphUuid: string | null,
  localNodeId: SerializedNodeId
): NodeLocatorId | null {
  const strictNodeId = requireNodeIdSegment(localNodeId)
  if (strictNodeId) return createNodeLocatorId(subgraphUuid, strictNodeId)

  const bareNodeId = parseNodeId(localNodeId)
  if (!bareNodeId) return null
  if (!subgraphUuid) return String(bareNodeId) as NodeLocatorId
  if (!UUID_PATTERN.test(subgraphUuid)) return null
  return `${subgraphUuid}:${bareNodeId}` as NodeLocatorId
}

/**
 * Parse a locator whose local ID may contain colons. A UUID-shaped first
 * segment denotes subgraph scope; otherwise the complete value is a root ID.
 */
export function parseLeafNodeLocatorId(
  id: string
): { subgraphUuid: string | null; localNodeId: NodeId } | null {
  const strict = parseNodeLocatorId(id)
  if (strict) return strict

  const separatorIndex = id.indexOf(':')
  if (separatorIndex === -1) return null

  const subgraphUuid = id.slice(0, separatorIndex)
  if (!UUID_PATTERN.test(subgraphUuid)) {
    const localNodeId = parseNodeId(id)
    return localNodeId ? { subgraphUuid: null, localNodeId } : null
  }

  const localNodeId = parseNodeId(id.slice(separatorIndex + 1))
  return localNodeId ? { subgraphUuid, localNodeId } : null
}

/**
 * Parse a NodeExecutionId into its component node IDs
 * @param id The NodeExecutionId to parse
 * @returns Array of node IDs from root to target, or null if not an execution ID
 */
export function parseNodeExecutionId(id: string): NodeId[] | null {
  const executionId = tryNormalizeNodeExecutionId(id)
  if (!executionId) return null

  return parseNodeIdSegments(executionId.split(':'))
}

/**
 * Create a NodeExecutionId from an array of node IDs
 * @param nodeIds Array of node IDs from root to target
 * @returns A properly formatted NodeExecutionId, or null when any segment is invalid
 */
export function createNodeExecutionId(
  nodeIds: readonly [SerializedNodeId, ...SerializedNodeId[]]
): NodeExecutionId
export function createNodeExecutionId(
  nodeIds: readonly SerializedNodeId[]
): NodeExecutionId | null
export function createNodeExecutionId(
  nodeIds: readonly SerializedNodeId[]
): NodeExecutionId | null {
  if (nodeIds.length === 0) return null

  const nodeIdSegments = parseNodeIdSegments(nodeIds)
  return nodeIdSegments
    ? nodeExecutionIdFromString(nodeIdSegments.join(':'))
    : null
}

/**
 * Create a `NodeExecutionId` for a single, already-local node id, tolerating
 * a colon inside it.
 *
 * `createNodeExecutionId` treats every array element as one path SEGMENT and
 * rejects a colon inside any of them, because colon is the separator between
 * segments once they are joined. That is the right contract for a real
 * multi-segment path, but it is too strict for the single-id, no-ancestor
 * case some callers hit: a node materialized at the root graph can have a
 * raw id that itself contains colons for reasons that have nothing to do
 * with subgraph-path encoding (comfy-multi-player's `insert_workflow`
 * remapped ids, e.g. `insert:<opId>:root:node:<originalId>`, PM-1580).
 * There is no ancestor segment to disambiguate such an id from, so nothing
 * is lost by keeping it whole rather than rejecting it outright.
 */
export function createLeafNodeExecutionId(
  nodeId: SerializedNodeId
): NodeExecutionId | null {
  const strict = createNodeExecutionId([nodeId])
  if (strict) return strict
  const bare = parseNodeId(nodeId)
  return bare ? (bare as unknown as NodeExecutionId) : null
}

export function tryNormalizeNodeExecutionId(
  value: string | number
): NodeExecutionId | null {
  return nodeExecutionIdFromString(String(value))
}

export function appendNodeExecutionId(
  parentExecutionId: NodeExecutionId,
  childNodeId: NodeId
): NodeExecutionId
export function appendNodeExecutionId(
  parentExecutionId: string,
  childNodeId: NodeId
): NodeExecutionId | null
export function appendNodeExecutionId(
  parentExecutionId: string,
  childNodeId: NodeId
): NodeExecutionId | null {
  const parentNodeIds = parseNodeExecutionId(parentExecutionId)
  if (!parentNodeIds) return null

  return createNodeExecutionId([...parentNodeIds, childNodeId])
}

/**
 * Returns all ancestor execution IDs for a given execution ID, including itself.
 *
 * Example: "65:70:63" → ["65", "65:70", "65:70:63"]
 */
export function getAncestorExecutionIds(
  executionId: string
): NodeExecutionId[] {
  const nodeIds = parseNodeExecutionId(executionId)
  if (!nodeIds) return []

  return nodeIds
    .map((_, index) => createNodeExecutionId(nodeIds.slice(0, index + 1)))
    .filter((id): id is NodeExecutionId => id !== null)
}

/**
 * Returns all ancestor execution IDs for a given execution ID, excluding itself.
 *
 * Example: "65:70:63" → ["65", "65:70"]
 */
export function getParentExecutionIds(executionId: string): NodeExecutionId[] {
  return getAncestorExecutionIds(executionId).slice(0, -1)
}

/**
 * Compare two NodeExecutionIds for ascending numeric sort order.
 * Splits each ID by ":" and compares segments numerically left to right.
 *
 * Example order: "1" < "1:20" < "2" < "10:11:12"
 */
export function compareExecutionId(
  a: string | undefined,
  b: string | undefined
): number {
  const parse = (id: string | undefined) => (id ?? '').split(':').map(Number)
  const idA = parse(a)
  const idB = parse(b)
  for (let i = 0; i < Math.max(idA.length, idB.length); i++) {
    const segA = idA[i] ?? 0
    const segB = idB[i] ?? 0
    const diff =
      (Number.isNaN(segA) ? 0 : segA) - (Number.isNaN(segB) ? 0 : segB)
    if (diff !== 0) return diff
  }
  return 0
}
