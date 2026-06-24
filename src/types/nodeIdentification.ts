import { nodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'

const NODE_EXECUTION_ID_PATTERN = /^[^:]+(?::[^:]+)*$/

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

function parseNodeIdSegment(part: string): NodeId {
  return nodeId(part)
}

function nodeExecutionIdFromString(value: string): NodeExecutionId | null {
  return NODE_EXECUTION_ID_PATTERN.test(value)
    ? (value as NodeExecutionId)
    : null
}

/**
 * Type guard to check if a value is a NodeLocatorId
 */
export function isNodeLocatorId(value: unknown): value is NodeLocatorId {
  if (typeof value !== 'string') return false

  // Check if it's a simple node ID (root graph node)
  const parts = value.split(':')
  if (parts.length === 1) {
    // Simple node ID - must be non-empty
    return value.length > 0
  }

  // Check for UUID:nodeId format
  if (parts.length !== 2) return false

  // Check that node ID part is not empty
  if (!parts[1]) return false

  // Basic UUID format check (8-4-4-4-12 hex characters)
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidPattern.test(parts[0])
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
  if (!isNodeLocatorId(id)) return null

  const parts = id.split(':')

  if (parts.length === 1) {
    // Simple node ID (root graph)
    return {
      subgraphUuid: null,
      localNodeId: parseNodeIdSegment(id)
    }
  }

  const [subgraphUuid, localNodeId] = parts
  return {
    subgraphUuid,
    localNodeId: parseNodeIdSegment(localNodeId)
  }
}

/**
 * Create a NodeLocatorId from components
 * @param subgraphUuid The UUID of the immediate containing subgraph
 * @param localNodeId The local node ID within that subgraph
 * @returns A properly formatted NodeLocatorId
 */
export function createNodeLocatorId(
  subgraphUuid: string | null,
  localNodeId: SerializedNodeId
): NodeLocatorId {
  return (
    subgraphUuid ? `${subgraphUuid}:${localNodeId}` : String(localNodeId)
  ) as NodeLocatorId
}

/**
 * Parse a NodeExecutionId into its component node IDs
 * @param id The NodeExecutionId to parse
 * @returns Array of node IDs from root to target, or null if not an execution ID
 */
export function parseNodeExecutionId(id: string): NodeId[] | null {
  const executionId = tryNormalizeNodeExecutionId(id)
  if (!executionId) return null

  return executionId.split(':').map(parseNodeIdSegment)
}

/**
 * Create a NodeExecutionId from an array of node IDs
 * @param nodeIds Array of node IDs from root to target
 * @returns A properly formatted NodeExecutionId
 */
export function createNodeExecutionId<
  const T extends readonly SerializedNodeId[]
>(nodeIds: T & (T extends readonly [] ? never : unknown)): NodeExecutionId {
  if (nodeIds.length === 0) {
    throw new Error('NodeExecutionId requires at least one node ID')
  }
  return nodeIds.map(String).join(':') as NodeExecutionId
}

export function tryNormalizeNodeExecutionId(
  value: string | number
): NodeExecutionId | null {
  return nodeExecutionIdFromString(String(value))
}

export function appendNodeExecutionId(
  parentExecutionId: string,
  childNodeId: SerializedNodeId
): NodeExecutionId {
  return createNodeExecutionId([...parentExecutionId.split(':'), childNodeId])
}

/**
 * Returns all ancestor execution IDs for a given execution ID, including itself.
 *
 * Example: "65:70:63" → ["65", "65:70", "65:70:63"]
 */
export function getAncestorExecutionIds(
  executionId: string
): NodeExecutionId[] {
  const normalized = tryNormalizeNodeExecutionId(executionId)
  if (!normalized) return []

  const parts = normalized.split(':')
  return Array.from({ length: parts.length }, (_, i) =>
    createNodeExecutionId(parts.slice(0, i + 1))
  )
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
