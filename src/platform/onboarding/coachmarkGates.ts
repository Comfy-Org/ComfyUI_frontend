import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNewUserService } from '@/services/useNewUserService'

export type CoachGate = () => boolean | Promise<boolean>

export function isNewUser(): boolean {
  return useNewUserService().isNewUser() === true
}

export function hasNoSavedWorkflows(): boolean {
  return useWorkflowStore().persistedWorkflows.length === 0
}
