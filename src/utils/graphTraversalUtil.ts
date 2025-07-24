import type { LGraph, LGraphNode, Subgraph } from '@comfyorg/litegraph'

import type { NodeLocatorId } from '@/types/nodeIdentification'
import { parseNodeLocatorId } from '@/types/nodeIdentification'

/**
 * Parses an execution ID into its component parts.
 *
 * @param executionId - The execution ID (e.g., "123:456:789" or "789")
 * @returns Array of node IDs in the path, or null if invalid
 */
export function parseExecutionId(executionId: string): string[] | null {
  if (!executionId || typeof executionId !== 'string') return null
  return executionId.split(':').filter((part) => part.length > 0)
}

/**
 * Extracts the local node ID from an execution ID.
 *
 * @param executionId - The execution ID (e.g., "123:456:789" or "789")
 * @returns The local node ID or null if invalid
 */
export function getLocalNodeIdFromExecutionId(
  executionId: string
): string | null {
  const parts = parseExecutionId(executionId)
  return parts ? parts[parts.length - 1] : null
}

/**
 * Extracts the subgraph path from an execution ID.
 *
 * @param executionId - The execution ID (e.g., "123:456:789" or "789")
 * @returns Array of subgraph node IDs (excluding the final node ID), or empty array
 */
export function getSubgraphPathFromExecutionId(executionId: string): string[] {
  const parts = parseExecutionId(executionId)
  return parts ? parts.slice(0, -1) : []
}

/**
 * Visits each node in a graph (non-recursive, single level).
 *
 * @param graph - The graph to visit nodes from
 * @param visitor - Function called for each node
 */
export function visitGraphNodes(
  graph: LGraph | Subgraph,
  visitor: (node: LGraphNode) => void
): void {
  for (const node of graph.nodes) {
    visitor(node)
  }
}

/**
 * Traverses a path of subgraphs to reach a target graph.
 *
 * @param startGraph - The graph to start from
 * @param path - Array of subgraph node IDs to traverse
 * @returns The target graph or null if path is invalid
 */
export function traverseSubgraphPath(
  startGraph: LGraph | Subgraph,
  path: string[]
): LGraph | Subgraph | null {
  let currentGraph: LGraph | Subgraph = startGraph

  for (const nodeId of path) {
    const node = currentGraph.getNodeById(nodeId)
    if (!node?.isSubgraphNode?.() || !node.subgraph) return null
    currentGraph = node.subgraph
  }

  return currentGraph
}

/**
 * Traverses all nodes in a graph hierarchy (including subgraphs) and invokes
 * a callback on each node that has the specified property.
 *
 * @param graph - The root graph to start traversal from
 * @param callbackProperty - The name of the callback property to invoke on each node
 */
export function triggerCallbackOnAllNodes(
  graph: LGraph | Subgraph,
  callbackProperty: keyof LGraphNode
): void {
  visitGraphNodes(graph, (node) => {
    // Recursively process subgraphs first
    if (node.isSubgraphNode?.() && node.subgraph) {
      triggerCallbackOnAllNodes(node.subgraph, callbackProperty)
    }

    // Invoke callback if it exists on the node
    const callback = node[callbackProperty]
    if (typeof callback === 'function') {
      callback.call(node)
    }
  })
}

/**
 * Collects all nodes in a graph hierarchy (including subgraphs) into a flat array.
 *
 * @param graph - The root graph to collect nodes from
 * @param filter - Optional filter function to include only specific nodes
 * @returns Array of all nodes in the graph hierarchy
 */
export function collectAllNodes(
  graph: LGraph | Subgraph,
  filter?: (node: LGraphNode) => boolean
): LGraphNode[] {
  const nodes: LGraphNode[] = []

  visitGraphNodes(graph, (node) => {
    // Recursively collect from subgraphs
    if (node.isSubgraphNode?.() && node.subgraph) {
      nodes.push(...collectAllNodes(node.subgraph, filter))
    }

    // Add node if it passes the filter (or no filter provided)
    if (!filter || filter(node)) {
      nodes.push(node)
    }
  })

  return nodes
}

/**
 * Finds a node by ID anywhere in the graph hierarchy.
 *
 * @param graph - The root graph to search
 * @param nodeId - The ID of the node to find
 * @returns The node if found, null otherwise
 */
export function findNodeInHierarchy(
  graph: LGraph | Subgraph,
  nodeId: string | number
): LGraphNode | null {
  // Check current graph
  const node = graph.getNodeById(nodeId)
  if (node) return node

  // Search in subgraphs
  for (const node of graph.nodes) {
    if (node.isSubgraphNode?.() && node.subgraph) {
      const found = findNodeInHierarchy(node.subgraph, nodeId)
      if (found) return found
    }
  }

  return null
}

/**
 * Find a subgraph by its UUID anywhere in the graph hierarchy.
 *
 * @param graph - The root graph to search
 * @param targetUuid - The UUID of the subgraph to find
 * @returns The subgraph if found, null otherwise
 */
export function findSubgraphByUuid(
  graph: LGraph | Subgraph,
  targetUuid: string
): Subgraph | null {
  // Check all nodes in the current graph
  for (const node of graph._nodes) {
    if (node.isSubgraphNode?.() && node.subgraph) {
      if (node.subgraph.id === targetUuid) {
        return node.subgraph
      }
      // Recursively search in nested subgraphs
      const found = findSubgraphByUuid(node.subgraph, targetUuid)
      if (found) return found
    }
  }
  return null
}

/**
 * Get a node by its execution ID from anywhere in the graph hierarchy.
 * Execution IDs use hierarchical format like "123:456:789" for nested nodes.
 *
 * @param rootGraph - The root graph to search from
 * @param executionId - The execution ID (e.g., "123:456:789" or "789")
 * @returns The node if found, null otherwise
 */
export function getNodeByExecutionId(
  rootGraph: LGraph,
  executionId: string
): LGraphNode | null {
  if (!rootGraph) return null

  const localNodeId = getLocalNodeIdFromExecutionId(executionId)
  if (!localNodeId) return null

  const subgraphPath = getSubgraphPathFromExecutionId(executionId)

  // If no subgraph path, it's in the root graph
  if (subgraphPath.length === 0) {
    return rootGraph.getNodeById(localNodeId) || null
  }

  // Traverse to the target subgraph
  const targetGraph = traverseSubgraphPath(rootGraph, subgraphPath)
  if (!targetGraph) return null

  // Get the node from the target graph
  return targetGraph.getNodeById(localNodeId) || null
}

/**
 * Get a node by its locator ID from anywhere in the graph hierarchy.
 * Locator IDs use UUID format like "uuid:nodeId" for subgraph nodes.
 *
 * @param rootGraph - The root graph to search from
 * @param locatorId - The locator ID (e.g., "uuid:123" or "123")
 * @returns The node if found, null otherwise
 */
export function getNodeByLocatorId(
  rootGraph: LGraph,
  locatorId: NodeLocatorId | string
): LGraphNode | null {
  if (!rootGraph) return null

  const parsedIds = parseNodeLocatorId(locatorId)
  if (!parsedIds) return null

  const { subgraphUuid, localNodeId } = parsedIds

  // If no subgraph UUID, it's in the root graph
  if (!subgraphUuid) {
    return rootGraph.getNodeById(localNodeId) || null
  }

  // Find the subgraph with the matching UUID
  const targetSubgraph = findSubgraphByUuid(rootGraph, subgraphUuid)
  if (!targetSubgraph) return null

  return targetSubgraph.getNodeById(localNodeId) || null
}
