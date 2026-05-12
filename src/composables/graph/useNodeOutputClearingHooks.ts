import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { isSubgraph } from '@/utils/typeGuardUtil'

export function installNodeOutputClearingHooks(graph: LGraph): () => void {
  const originalOnNodeRemoved = graph.onNodeRemoved

  graph.onNodeRemoved = function (node: LGraphNode) {
    const { nodeIdToNodeLocatorId } = useWorkflowStore()
    const locatorId = isSubgraph(graph)
      ? nodeIdToNodeLocatorId(node.id, graph)
      : String(node.id)
    useNodeOutputStore().removeOutputsByLocatorId(locatorId)
    originalOnNodeRemoved?.call(this, node)
  }

  return () => {
    graph.onNodeRemoved = originalOnNodeRemoved || undefined
  }
}
