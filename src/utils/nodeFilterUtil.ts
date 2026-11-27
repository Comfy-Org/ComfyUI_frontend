import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { nodeDefinition } from '@/lib/litegraph/src/nodeConstruction'

export const isOutputNode = (node: LGraphNode) =>
  nodeDefinition(node)?.output_node

/**
 * Filters nodes to find only output nodes.
 * Output nodes are nodes that have the output_node flag set in their nodeData.
 *
 * @param nodes - Array of nodes to filter
 * @returns Array of output nodes only
 */
export const filterOutputNodes = (nodes: LGraphNode[]): LGraphNode[] =>
  nodes.filter(isOutputNode)
