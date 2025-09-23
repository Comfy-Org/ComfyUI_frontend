import { storeToRefs } from 'pinia'
import { type MaybeRefOrGetter, computed, toValue } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'

/**
 * Composable for managing execution state of Vue-based nodes
 *
 * Provides reactive access to execution state and progress for a specific node
 * by injecting execution data from the parent GraphCanvas provider.
 *
 * @param nodeIdMaybe - The ID of the node to track execution state for
 * @returns Object containing reactive execution state and progress
 */
export const useNodeExecutionState = (
  nodeIdMaybe: MaybeRefOrGetter<string>
) => {
  const nodeId = toValue(nodeIdMaybe)
  const { uniqueExecutingNodeIdStrings, nodeProgressStates } =
    storeToRefs(useExecutionStore())

  const executing = computed(() => {
    return uniqueExecutingNodeIdStrings.value.has(nodeId)
  })

  const progress = computed(() => {
    const state = nodeProgressStates.value[nodeId]
    return state?.max > 0 ? state.value / state.max : undefined
  })

  const progressState = computed(() => nodeProgressStates.value[nodeId])

  const progressPercentage = computed(() => {
    const prog = progress.value
    return prog !== undefined ? Math.round(prog * 100) : undefined
  })

  const executionState = computed(() => {
    const state = progressState.value
    if (!state) return 'idle'
    return state.state
  })

  return {
    executing,
    progress,
    progressPercentage,
    progressState,
    executionState
  }
}
