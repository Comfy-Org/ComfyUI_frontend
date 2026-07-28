import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import type { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import ManagerDialog from '@/workbench/extensions/manager/components/manager/ManagerDialog.vue'

const DIALOG_KEY = 'global-manager'

const MANAGER_CONTENT_CLASS =
  'w-[90vw] max-w-[1724px] sm:max-w-[1724px] h-[80vh] max-h-[1026px] min-[3000px]:max-w-[2200px] min-[3000px]:max-h-[1320px] rounded-2xl overflow-hidden'

export function useManagerDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(initialTab?: ManagerTab, initialPackId?: string) {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ManagerDialog,
      props: {
        onClose: hide,
        initialTab,
        initialPackId
      },
      dialogComponentProps: {
        // Manager hosts PrimeVue overlays (SingleSelect, SearchAutocomplete)
        // teleported to body. Reka's modal mode traps focus and disables body
        // pointer-events, breaking those overlays. Mirrors Settings.
        modal: false,
        size: 'full',
        contentClass: MANAGER_CONTENT_CLASS
      }
    })
  }

  return {
    show,
    hide
  }
}
