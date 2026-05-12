import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { isSubgraph } from '@/utils/typeGuardUtil'

function clearInteriorOutputs(subgraphNode: SubgraphNode) {
  const subgraph: Subgraph | undefined = subgraphNode.subgraph
  if (!subgraph) return

  const store = useNodeOutputStore()
  for (const interior of subgraph.nodes) {
    store.removeOutputsByLocatorId(`${subgraph.id}:${interior.id}`)
    if (interior.isSubgraphNode()) {
      clearInteriorOutputs(interior)
    }
  }
}

export function installNodeOutputClearingHooks(graph: LGraph): () => void {
  const originalOnNodeRemoved = graph.onNodeRemoved

  graph.onNodeRemoved = function (node: LGraphNode) {
    const store = useNodeOutputStore()
    const { nodeIdToNodeLocatorId } = useWorkflowStore()
    const locatorId = isSubgraph(graph)
      ? nodeIdToNodeLocatorId(node.id, graph)
      : String(node.id)
    store.removeOutputsByLocatorId(locatorId)

    if (node.isSubgraphNode()) {
      clearInteriorOutputs(node)
    }

    originalOnNodeRemoved?.call(this, node)
  }

  return () => {
    graph.onNodeRemoved = originalOnNodeRemoved || undefined
  }
}
