import { watch } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'

export function useWorkflowStatusDismissal() {
  const workflowStore = useWorkflowStore()
  const executionStore = useExecutionStore()

  watch(
    () => {
      const workflow = workflowStore.activeWorkflow
      return [workflow, executionStore.getWorkflowStatus(workflow)] as const
    },
    ([workflow, status]) => {
      if (workflow && status !== undefined && status !== 'running') {
        executionStore.clearWorkflowStatus(workflow)
      }
    },
    { immediate: true }
  )
}
