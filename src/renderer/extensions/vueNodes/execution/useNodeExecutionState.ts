import { computed, inject, ref } from 'vue'

import {
  ExecutingNodeIdsKey,
  NodeProgressStatesKey
} from '@/renderer/core/canvas/injectionKeys'
import type { NodeProgressState } from '@/schemas/apiSchema'

/**
 * Composable for managing execution state of Vue-based nodes
 *
 * Provides reactive access to execution state and progress for a specific node
 * by injecting execution data from the parent GraphCanvas provider.
 *
 * @param nodeId - The ID of the node to track execution state for
 * @returns Object containing reactive execution state and progress
 */
export const useNodeExecutionState = (nodeId: string) => {
  // Inject execution state from parent GraphCanvas
  const executingNodeIds = inject(ExecutingNodeIdsKey, ref(new Set<string>()))
  const nodeProgressStates = inject(
    NodeProgressStatesKey,
    ref<Record<string, NodeProgressState>>({})
  )

  // Computed execution state - only re-evaluates when this node's execution state changes
  const executing = computed(() => {
    return executingNodeIds.value.has(nodeId)
  })

  // Computed progress state - returns progress percentage (0-1) or undefined
  const progress = computed(() => {
    const state = nodeProgressStates.value[nodeId]
    return state?.max > 0 ? state.value / state.max : undefined
  })

  // Raw progress state for advanced use cases
  const progressState = computed(() => nodeProgressStates.value[nodeId])

  // Convenience computed for progress display
  const progressPercentage = computed(() => {
    const prog = progress.value
    return prog !== undefined ? Math.round(prog * 100) : undefined
  })

  // Execution state details
  const executionState = computed(() => {
    const state = progressState.value
    if (!state) return 'idle'
    return state.state // 'pending' | 'running' | 'finished' | 'error'
  })

  return {
    /**
     * Whether this node is currently executing
     */
    executing,

    /**
     * Progress as a decimal (0-1) or undefined if no progress available
     */
    progress,

    /**
     * Progress as a percentage (0-100) or undefined if no progress available
     */
    progressPercentage,

    /**
     * Raw progress state object from execution store
     */
    progressState,

    /**
     * Current execution state: 'idle' | 'pending' | 'running' | 'finished' | 'error'
     */
    executionState
  }
}
