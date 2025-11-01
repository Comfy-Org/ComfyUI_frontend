import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

export interface NodeMetrics {
  custom_node_count: number
  api_node_count: number
  subgraph_count: number
  total_node_count: number
  has_api_nodes: boolean
  api_node_names: string[]
}

/**
 * Computes node composition metrics for a given graph.
 *
 * Analyzes the graph to determine:
 * - Total node count
 * - Custom node count (from extensions)
 * - API node count (ComfyUI API nodes)
 * - Subgraph count (nested workflows)
 * - API node names
 *
 * @param graph - The LiteGraph instance to analyze
 * @param nodeDefsByName - Map of node type to node definition
 * @returns Node metrics including counts and API node information
 */
export function computeNodeMetrics(
  graph: LGraph | null,
  nodeDefsByName: Record<string, ComfyNodeDefImpl>
): NodeMetrics {
  const defaultMetrics: NodeMetrics = {
    custom_node_count: 0,
    api_node_count: 0,
    subgraph_count: 0,
    total_node_count: 0,
    has_api_nodes: false,
    api_node_names: []
  }

  if (!graph) {
    return defaultMetrics
  }

  try {
    const nodes = collectAllNodes(graph)

    let customNodeCount = 0
    let apiNodeCount = 0
    let subgraphCount = 0
    let totalNodeCount = 0
    let hasApiNodes = false
    const apiNodeNames = new Set<string>()

    for (const node of nodes) {
      totalNodeCount += 1
      const nodeDef = nodeDefsByName[node.type ?? '']
      const isCustomNode =
        nodeDef?.nodeSource?.type === NodeSourceType.CustomNodes
      const isApiNode = nodeDef?.api_node === true
      const isSubgraph = node.isSubgraphNode?.() === true
      if (isCustomNode) customNodeCount += 1
      if (isApiNode) {
        apiNodeCount += 1
        hasApiNodes = true
        if (nodeDef?.name) apiNodeNames.add(nodeDef.name)
      }
      if (isSubgraph) subgraphCount += 1
    }

    return {
      custom_node_count: customNodeCount,
      api_node_count: apiNodeCount,
      subgraph_count: subgraphCount,
      total_node_count: totalNodeCount,
      has_api_nodes: hasApiNodes,
      api_node_names: Array.from(apiNodeNames)
    }
  } catch (error) {
    console.error('Failed to compute node metrics:', error)
    return defaultMetrics
  }
}
