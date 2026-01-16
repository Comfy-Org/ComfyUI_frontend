import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'
import { useWorkspaceAuthStore } from '@/stores/workspaceAuthStore'

export function useWorkspaceSwitch() {
  const { t } = useI18n()
  const workspaceAuthStore = useWorkspaceAuthStore()
  const { currentWorkspace } = storeToRefs(workspaceAuthStore)
  const workflowStore = useWorkflowStore()
  const dialogService = useDialogService()

  function hasUnsavedChanges(): boolean {
    return workflowStore.modifiedWorkflows.length > 0
  }

  async function switchWithConfirmation(workspaceId: string): Promise<boolean> {
    if (currentWorkspace.value?.id === workspaceId) {
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
      await workspaceAuthStore.switchWorkspace(workspaceId)
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
