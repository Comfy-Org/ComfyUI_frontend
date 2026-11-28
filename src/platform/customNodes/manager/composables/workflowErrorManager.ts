import type { WorkflowErrorManager } from '@/platform/workflowErrors/workflowErrorManager'
import { useMissingNodes } from '@/platform/customNodes/manager/composables/nodePack/useMissingNodes'
import { usePackInstall } from '@/platform/customNodes/manager/composables/nodePack/usePackInstall'
import { useApplyChanges } from '@/platform/customNodes/manager/composables/useApplyChanges'
import { useManagerDialog } from '@/platform/customNodes/manager/composables/dialogs/useManagerDialog'
import { useManagerState } from '@/platform/customNodes/manager/composables/useManagerState'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import { ManagerTab } from '@/platform/customNodes/manager/types/comfyManagerTypes'

export function createWorkflowErrorManager(): WorkflowErrorManager {
  const managerStore = useComfyManagerStore()
  const { openManager } = useManagerDialog()

  return {
    useMissingNodes,
    usePackInstall,
    useApplyChanges,
    useManagerState,
    isPackInstalled: managerStore.isPackInstalled,
    openManager: ({ initialTab, initialPackId }) =>
      openManager({
        initialTab:
          initialTab === 'missing' ? ManagerTab.Missing : ManagerTab.All,
        initialPackId
      })
  }
}
