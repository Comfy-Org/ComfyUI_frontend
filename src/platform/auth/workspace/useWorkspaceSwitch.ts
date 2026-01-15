import { useI18n } from 'vue-i18n'

import { useWorkspaceAuth } from '@/platform/auth/workspace/useWorkspaceAuth'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'

export function useWorkspaceSwitch() {
  const { t } = useI18n()
  const workspaceAuth = useWorkspaceAuth()
  const workflowStore = useWorkflowStore()
  const dialogService = useDialogService()

  function hasUnsavedChanges(): boolean {
    return workflowStore.activeWorkflow?.isModified ?? false
  }

  async function switchWithConfirmation(workspaceId: string): Promise<boolean> {
    if (workspaceAuth.currentWorkspace.value?.id === workspaceId) {
      return true
    }

    if (hasUnsavedChanges()) {
      const confirmed = await dialogService.confirm({
        title: t('workspace.unsavedChanges.title'),
        message: t('workspace.unsavedChanges.message'),
        type: 'dirtyClose'
      })

      if (!confirmed) {
        return false
      }
    }

    try {
      await workspaceAuth.switchWorkspace(workspaceId)
      window.location.reload()
      return true
    } catch {
      return false
    }
  }

  return {
    hasUnsavedChanges,
    switchWithConfirmation
  }
}
