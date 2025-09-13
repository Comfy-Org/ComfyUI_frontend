import { computed, provide } from 'vue'

import { ExecutionErrorNodeIdKey } from '@/renderer/core/canvas/injectionKeys'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowStore } from '@/stores/workflowStore'

/**
 * Provider composable for execution error state.
 * Converts execution store's locator-based error tracking to local node IDs.
 * Automatically provides the error state to child components via dependency injection.
 */
export function useExecutionErrorProvider() {
  const executionStore = useExecutionStore()
  const workflowStore = useWorkflowStore()

  const currentErrorNodeId = computed(() => {
    const locator = executionStore.lastExecutionErrorNodeLocatorId
    if (!locator) return null
    const localId = workflowStore.nodeLocatorIdToNodeId(locator)
    return localId != null ? String(localId) : null
  })

  provide(ExecutionErrorNodeIdKey, currentErrorNodeId)

  return {
    currentErrorNodeId
  }
}
