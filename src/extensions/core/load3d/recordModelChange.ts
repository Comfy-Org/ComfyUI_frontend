import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export function recordModelChange() {
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}
