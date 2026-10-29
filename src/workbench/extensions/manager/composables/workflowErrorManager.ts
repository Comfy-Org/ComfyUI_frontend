import type { WorkflowErrorManager } from '@/platform/workflowErrors/workflowErrorManager'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'
import { useApplyChanges } from '@/workbench/extensions/manager/composables/useApplyChanges'
import { useManagerDialog } from '@/workbench/extensions/manager/composables/useManagerDialog'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

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
