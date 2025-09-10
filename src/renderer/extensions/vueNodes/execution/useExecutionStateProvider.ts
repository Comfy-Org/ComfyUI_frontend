import { computed, provide } from 'vue'

import {
  ExecutingNodeIdsKey,
  NodeProgressStatesKey
} from '@/renderer/core/canvas/injectionKeys'
import { useExecutionStore } from '@/stores/executionStore'

/**
 * Composable for providing execution state to Vue node children
 *
 * This composable sets up the execution state providers that can be injected
 * by child Vue nodes using useNodeExecutionState.
 *
 * Should be used in the parent component that manages Vue nodes (e.g., GraphCanvas).
 */
export const useExecutionStateProvider = () => {
  const executionStore = useExecutionStore()

  // Convert execution store data to the format expected by Vue nodes
  const executingNodeIds = computed(
    () => new Set(executionStore.executingNodeIds.map(String))
  )

  const nodeProgressStates = computed(() => executionStore.nodeProgressStates)

  // Provide the execution state to all child Vue nodes
  provide(ExecutingNodeIdsKey, executingNodeIds)
  provide(NodeProgressStatesKey, nodeProgressStates)

  return {
    executingNodeIds,
    nodeProgressStates
  }
}
