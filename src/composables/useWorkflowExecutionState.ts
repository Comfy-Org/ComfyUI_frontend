import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import type { WorkflowExecutionState } from '@/stores/executionStore'
import { useExecutionStore } from '@/stores/executionStore'

export function useWorkflowExecutionState(
  workflowId: MaybeRefOrGetter<string | undefined>
) {
  const executionStore = useExecutionStore()

  const state = computed<WorkflowExecutionState>(() =>
    executionStore.getWorkflowExecutionState(toValue(workflowId))
  )

  function clearResult() {
    const wid = toValue(workflowId)
    if (wid) {
      executionStore.clearWorkflowExecutionResult(wid)
    }
  }

  return {
    state,
    clearResult
  }
}
