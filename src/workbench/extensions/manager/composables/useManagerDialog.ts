import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import type { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import ManagerDialog from '@/workbench/extensions/manager/components/manager/ManagerDialog.vue'

const DIALOG_KEY = 'global-manager'

export function useManagerDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  async function show(initialTab?: ManagerTab) {

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ManagerDialog,
      props: {
        onClose: hide,
        initialTab
      },
      dialogComponentProps: {
        pt: {
          content: { class: '!px-0 overflow-hidden h-full !py-0' }
        }
      }
    })
  }

  return {
    show,
    hide
  }
}
