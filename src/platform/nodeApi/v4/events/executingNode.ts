import { watch } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { useExecutionStore } from '@/stores/executionStore'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandle, Unsubscribe } from '@/platform/nodeApi/v4/types'

export function createExecutingNode(
  nodes: NodeHandles,
  getGraph: () => LGraph | null
): {
  executingNode(): NodeHandle | undefined
  executionNode(id: string): NodeHandle | undefined
  onExecutingNodeChanged(
    listener: (node: NodeHandle | undefined) => void
  ): Unsubscribe
} {
  function nodeAt(executionId: string | null): NodeHandle | undefined {
    const root = getGraph()?.rootGraph
    if (!root || !executionId) return undefined
    const node = getNodeByExecutionId(root, executionId)
    return node?.graph ? nodes.find(node.graph, String(node.id)) : undefined
  }

  return {
    executingNode: () => nodeAt(useExecutionStore().executingNodeId),
    executionNode(id) {
      if (typeof id !== 'string') {
        throw invalidArgument('executionNode', 'an execution id', id)
      }
      return nodeAt(id)
    },
    onExecutingNodeChanged: createHostEvent<[NodeHandle | undefined]>(
      'onExecutingNodeChanged',
      (emit) =>
        watch(
          () => useExecutionStore().executingNodeId,
          (executionId) => emit(nodeAt(executionId))
        )
    )
  }
}
