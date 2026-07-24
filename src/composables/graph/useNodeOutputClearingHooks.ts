import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { getExecutionIdForNodeInGraph } from '@/utils/graphTraversalUtil'
import { isSubgraph } from '@/utils/typeGuardUtil'

function isTabSwitchTeardown(): boolean {
  const tracker = useWorkflowStore().activeWorkflow?.changeTracker
  return ChangeTracker.isLoadingGraph && !tracker?._restoringState
}

function dropTrackerCacheEntry(execId: string) {
  if (isTabSwitchTeardown()) return
  const tracked = useWorkflowStore().activeWorkflow?.changeTracker?.nodeOutputs
  if (tracked) delete tracked[execId]
}

function clearInteriorOutputs(
  subgraphNode: SubgraphNode,
  execIdPrefix: string
) {
  const subgraph: Subgraph | undefined = subgraphNode.subgraph
  if (!subgraph) return

  const store = useNodeOutputStore()
  for (const interior of subgraph.nodes) {
    store.removeOutputsByLocatorId(`${subgraph.id}:${interior.id}`)
    const interiorExecId = `${execIdPrefix}:${interior.id}`
    dropTrackerCacheEntry(interiorExecId)
    if (interior.isSubgraphNode()) {
      clearInteriorOutputs(interior, interiorExecId)
    }
  }
}

export function installNodeOutputClearingHooks(graph: LGraph): () => void {
  const originalOnNodeRemoved = graph.onNodeRemoved

  graph.onNodeRemoved = function (node: LGraphNode) {
    try {
      const store = useNodeOutputStore()
      const { nodeIdToNodeLocatorId } = useWorkflowStore()
      const locatorId = isSubgraph(graph)
        ? nodeIdToNodeLocatorId(node.id, graph)
        : String(node.id)
      store.removeOutputsByLocatorId(locatorId)

      const execId = app.rootGraph
        ? getExecutionIdForNodeInGraph(app.rootGraph, graph, node.id)
        : String(node.id)
      dropTrackerCacheEntry(execId)

      if (node.isSubgraphNode()) {
        clearInteriorOutputs(node, execId)
      }
    } finally {
      originalOnNodeRemoved?.call(this, node)
    }
  }

  return () => {
    graph.onNodeRemoved = originalOnNodeRemoved || undefined
  }
}
