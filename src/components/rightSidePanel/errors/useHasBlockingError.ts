import { computed } from 'vue'

import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'

export function useHasBlockingError() {
  const executionErrorStore = useExecutionErrorStore()

  return computed(() => {
    if (executionErrorStore.lastPromptError) return true
    const executionError = executionErrorStore.lastExecutionError
    if (
      executionError?.node_id != null &&
      tryNormalizeNodeExecutionId(executionError.node_id)
    ) {
      return true
    }

    return Object.entries(executionErrorStore.surfacedNodeErrors ?? {}).some(
      ([nodeId, nodeError]) =>
        !!tryNormalizeNodeExecutionId(nodeId) && nodeError.errors.length > 0
    )
  })
}
