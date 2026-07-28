import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { NodeState } from '@/types/nodeState'
import { locatorIdFromState } from '@/utils/graphTraversalUtil'
import type { UUID } from '@/utils/uuid'

/**
 * Whether a node currently carries an error, derived from the error stores.
 *
 * `node.has_errors` is deliberately not consulted: it is a plain class field
 * written by a watcher, so Vue cannot track it and a caller would latch on
 * after the underlying error cleared. Every source that watcher folds in is
 * queried directly here instead.
 */
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
