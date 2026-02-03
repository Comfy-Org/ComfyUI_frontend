import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'

export type WorkflowExecutionState = 'idle' | 'running' | 'completed' | 'error'

export function useWorkflowExecutionState(
  workflowId: MaybeRefOrGetter<string | undefined>
) {
  const executionStore = useExecutionStore()

  const state = computed<WorkflowExecutionState>(() => {
    const wid = toValue(workflowId)
    if (!wid) return 'idle'

    for (const promptId of executionStore.runningPromptIds) {
      if (executionStore.promptIdToWorkflowId.get(promptId) === wid) {
        return 'running'
      }
    }

    const lastResult = executionStore.lastExecutionResultByWorkflowId.get(wid)
    if (lastResult) {
      return lastResult.state
    }

    return 'idle'
  })

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
