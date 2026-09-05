import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { NodeState } from '@/types/nodeState'
import { locatorIdFromState } from '@/utils/graphTraversalUtil'
import type { UUID } from '@/utils/uuid'

/** Reads the error stores directly; `node.has_errors` is untracked and would latch. */
export function nodeHasError(
  state: NodeState,
  rootGraphId: UUID | undefined,
  node: LGraphNode | null
): boolean {
  const executionErrorStore = useExecutionErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingMediaStore = useMissingMediaStore()

  if (executionErrorStore.lastExecutionErrorNodeId === state.id) return true

  const locatorId = locatorIdFromState(state, rootGraphId)
  const hasNodeScopedError =
    locatorId !== null &&
    !!(
      executionErrorStore.getNodeErrors(locatorId) ||
      missingModelStore.hasMissingModelOnNode(locatorId) ||
      missingMediaStore.hasMissingMediaOnNode(locatorId)
    )
  if (hasNodeScopedError) return true

  return (
    node !== null &&
    (executionErrorStore.isContainerWithInternalError(node) ||
      useMissingNodesErrorStore().isContainerWithMissingNode(node) ||
      missingModelStore.isContainerWithMissingModel(node) ||
      missingMediaStore.isContainerWithMissingMedia(node))
  )
}
