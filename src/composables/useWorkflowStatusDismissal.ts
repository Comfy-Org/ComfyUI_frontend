import { watch } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'

export function useWorkflowStatusDismissal() {
  const workflowStore = useWorkflowStore()
  const executionStore = useExecutionStore()

  watch(
    () => workflowStore.activeWorkflow,
    (workflow) => {
      if (
        workflow &&
        executionStore.getWorkflowStatus(workflow) !== 'running'
      ) {
        executionStore.clearWorkflowStatus(workflow)
      }
    },
    { immediate: true }
  )
}
