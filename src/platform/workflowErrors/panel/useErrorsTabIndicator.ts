import { storeToRefs } from 'pinia'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useApp } from '@/scripts/appInstance'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import {
  getActiveGraphNodeIds,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'

import { useHasBlockingError } from './useHasBlockingError'

interface ErrorsTabSelection {
  hasSelection: MaybeRefOrGetter<boolean>
  selectedNodes: MaybeRefOrGetter<readonly LGraphNode[]>
  currentGraph: MaybeRefOrGetter<LGraph | null | undefined>
}

/**
 * Whether the errors tab has issues relevant to a selection (or to the whole
 * workflow when nothing is selected), and whether any of them block a run.
 */
export function useErrorsTabIndicator({
  hasSelection,
  selectedNodes,
  currentGraph
}: ErrorsTabSelection) {
  const executionErrorStore = useExecutionErrorStore()
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const { activeMissingModelGraphIds } = storeToRefs(useMissingModelStore())
  const { activeMissingMediaGraphIds } = storeToRefs(useMissingMediaStore())
  const { hasAnyError, allErrorExecutionIds } = storeToRefs(executionErrorStore)

  const activeMissingNodeGraphIds = computed<Set<string>>(() => {
    const app = useApp()
    if (!app.isGraphReady) return new Set()
    return getActiveGraphNodeIds(
      app.rootGraph,
      toValue(currentGraph) ?? app.rootGraph,
      missingNodesErrorStore.missingAncestorExecutionIds
    )
  })

  function someSelectedNode(predicate: (node: LGraphNode) => boolean) {
    return toValue(selectedNodes).some(predicate)
  }

  function selectedNodeIn(ids: Set<string>) {
    return someSelectedNode((node) => ids.has(String(node.id)))
  }

  const hasContainerInternalError = computed(
    () =>
      allErrorExecutionIds.value.length > 0 &&
      someSelectedNode(
        (node) =>
          node instanceof SubgraphNode &&
          executionErrorStore.isContainerWithInternalError(node)
      )
  )

  const hasRelevantErrors = computed(() => {
    if (!toValue(hasSelection)) return hasAnyError.value
    return (
      selectedNodeIn(executionErrorStore.activeGraphErrorNodeIds) ||
      hasContainerInternalError.value ||
      selectedNodeIn(activeMissingNodeGraphIds.value) ||
      selectedNodeIn(activeMissingModelGraphIds.value) ||
      selectedNodeIn(activeMissingMediaGraphIds.value)
    )
  })

  const hasPendingErrorScanSelected = computed(() => {
    const app = useApp()
    if (!app.isGraphReady) return false
    const rootGraph = app.rootGraph
    return someSelectedNode((node) => {
      const executionId = getExecutionIdByNode(rootGraph, node)
      return (
        executionId !== null &&
        executionErrorStore.hasPendingAddedNodeErrorScan(rootGraph, executionId)
      )
    })
  })

  return {
    hasRelevantErrors,
    hasPendingErrorScanSelected,
    hasBlockingError: useHasBlockingError()
  }
}
