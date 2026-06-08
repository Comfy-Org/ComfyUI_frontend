import { watch } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'

export function useWorkflowStatusDismissal() {
  const workflowStore = useWorkflowStore()
  const executionStore = useExecutionStore()

  watch(
    () => {
      const workflow = workflowStore.activeWorkflow
      return workflow ? executionStore.getWorkflowStatus(workflow) : undefined
    },
    (status) => {
      const workflow = workflowStore.activeWorkflow
      if (workflow && status && status !== 'running') {
        executionStore.clearWorkflowStatus(workflow)
      }
    },
    { immediate: true }
  )
}
