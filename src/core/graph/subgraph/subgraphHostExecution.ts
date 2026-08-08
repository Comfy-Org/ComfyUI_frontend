import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  appendNodeExecutionId,
  createNodeExecutionId,
  getAncestorExecutionIds
} from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

export function findUniqueSubgraphHostExecutionId(
  rootGraph: LGraph,
  targetSubgraph: Subgraph
): NodeExecutionId | undefined {
  let match: NodeExecutionId | undefined
  let isAmbiguous = false

  function visit(
    graph: LGraph | Subgraph,
    parentExecutionId: NodeExecutionId | undefined,
    ancestorSubgraphIds: ReadonlySet<string>
  ): void {
    for (const node of graph.nodes) {
      if (!node.isSubgraphNode()) continue
      if (ancestorSubgraphIds.has(node.subgraph.id)) continue

      const executionId = parentExecutionId
        ? appendNodeExecutionId(parentExecutionId, node.id)
        : createNodeExecutionId([node.id])

      if (node.subgraph === targetSubgraph) {
        if (match) {
          isAmbiguous = true
          return
        }
        match = executionId
      }

      const nextAncestorIds = new Set(ancestorSubgraphIds)
      nextAncestorIds.add(node.subgraph.id)
      visit(node.subgraph, executionId, nextAncestorIds)
      if (isAmbiguous) return
    }
  }

  visit(rootGraph, undefined, new Set())
  return isAmbiguous ? undefined : match
}

export function findSubgraphHostAncestorExecutionId(
  rootGraph: LGraph,
  currentHostExecutionId: NodeExecutionId | undefined,
  targetSubgraph: Subgraph
): NodeExecutionId | undefined {
  if (!currentHostExecutionId) return undefined

  for (const executionId of getAncestorExecutionIds(
    currentHostExecutionId
  ).reverse()) {
    const node = getNodeByExecutionId(rootGraph, executionId)
    if (node?.isSubgraphNode() && node.subgraph === targetSubgraph) {
      return executionId
    }
  }

  return undefined
}

export function resolveEnteredSubgraphHostExecutionId(
  rootGraph: LGraph,
  currentHostExecutionId: NodeExecutionId | undefined,
  closingGraph: LGraph | Subgraph,
  fromNode: SubgraphNode
): NodeExecutionId | undefined {
  if (fromNode.graph !== closingGraph) return undefined
  if (closingGraph === rootGraph) {
    return createNodeExecutionId([fromNode.id])
  }
  if (!currentHostExecutionId) return undefined

  const currentHost = getNodeByExecutionId(rootGraph, currentHostExecutionId)
  if (!currentHost?.isSubgraphNode() || currentHost.subgraph !== closingGraph) {
    return undefined
  }

  return appendNodeExecutionId(currentHostExecutionId, fromNode.id)
}
