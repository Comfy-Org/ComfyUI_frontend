import type { LGraph, LGraphNode, Subgraph } from '@comfyorg/litegraph'

import type { NodeLocatorId } from '@/types/nodeIdentification'
import { parseNodeLocatorId } from '@/types/nodeIdentification'

import { isSubgraphIoNode } from './typeGuardUtil'

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
  forEachNode(graph, (node) => {
    const callback = node[callbackProperty]
    if (typeof callback === 'function') {
      callback.call(node)
    }
  })
}

/**
 * Maps a function over all nodes in a graph hierarchy (including subgraphs).
 * This is a pure functional traversal that doesn't mutate the graph.
 *
 * @param graph - The root graph to traverse
 * @param mapFn - Function to apply to each node
 * @returns Array of mapped results (excluding undefined values)
 */
export function mapAllNodes<T>(
  graph: LGraph | Subgraph,
  mapFn: (node: LGraphNode) => T | undefined
): T[] {
  const results: T[] = []

  visitGraphNodes(graph, (node) => {
    // Recursively map over subgraphs first
    if (node.isSubgraphNode?.() && node.subgraph) {
      results.push(...mapAllNodes(node.subgraph, mapFn))
    }

    // Apply map function to current node
    const result = mapFn(node)
    if (result !== undefined) {
      results.push(result)
    }
  })

  return results
}

/**
 * Executes a side-effect function on all nodes in a graph hierarchy.
 * This is for operations that modify nodes or perform side effects.
 *
 * @param graph - The root graph to traverse
 * @param fn - Function to execute on each node
 */
export function forEachNode(
  graph: LGraph | Subgraph,
  fn: (node: LGraphNode) => void
): void {
  visitGraphNodes(graph, (node) => {
    // Recursively process subgraphs first
    if (node.isSubgraphNode?.() && node.subgraph) {
      forEachNode(node.subgraph, fn)
    }

    // Execute function on current node
    fn(node)
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
  return mapAllNodes(graph, (node) => {
    if (!filter || filter(node)) {
      return node
    }
    return undefined
  })
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

/**
 * Finds the root graph from any graph in the hierarchy.
 *
 * @param graph - Any graph or subgraph in the hierarchy
 * @returns The root graph
 */
export function getRootGraph(graph: LGraph | Subgraph): LGraph | Subgraph {
  let current: LGraph | Subgraph = graph
  while ('rootGraph' in current && current.rootGraph) {
    current = current.rootGraph
  }
  return current
}

/**
 * Applies a function to all nodes whose type matches a subgraph ID.
 * Operates on the entire graph hierarchy starting from the root.
 *
 * @param rootGraph - The root graph to search in
 * @param subgraphId - The ID/type of the subgraph to match nodes against
 * @param fn - Function to apply to each matching node
 */
export function forEachSubgraphNode(
  rootGraph: LGraph | Subgraph | null | undefined,
  subgraphId: string | null | undefined,
  fn: (node: LGraphNode) => void
): void {
  if (!rootGraph || !subgraphId) return

  forEachNode(rootGraph, (node) => {
    if (node.type === subgraphId) {
      fn(node)
    }
  })
}

/**
 * Maps a function over all nodes whose type matches a subgraph ID.
 * Operates on the entire graph hierarchy starting from the root.
 *
 * @param rootGraph - The root graph to search in
 * @param subgraphId - The ID/type of the subgraph to match nodes against
 * @param mapFn - Function to apply to each matching node
 * @returns Array of mapped results
 */
export function mapSubgraphNodes<T>(
  rootGraph: LGraph | Subgraph | null | undefined,
  subgraphId: string | null | undefined,
  mapFn: (node: LGraphNode) => T
): T[] {
  if (!rootGraph || !subgraphId) return []

  return mapAllNodes(rootGraph, (node) => {
    if (node.type === subgraphId) {
      return mapFn(node)
    }
    return undefined
  })
}

/**
 * Gets all non-IO nodes from a subgraph (excludes SubgraphInputNode and SubgraphOutputNode).
 * These are the user-created nodes that can be safely removed when clearing a subgraph.
 *
 * @param subgraph - The subgraph to get non-IO nodes from
 * @returns Array of non-IO nodes (user-created nodes)
 */
export function getAllNonIoNodesInSubgraph(subgraph: Subgraph): LGraphNode[] {
  return subgraph.nodes.filter((node) => !isSubgraphIoNode(node))
}
