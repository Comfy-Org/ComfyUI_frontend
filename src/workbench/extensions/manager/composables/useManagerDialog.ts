import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import type { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import ManagerDialog from '@/workbench/extensions/manager/components/manager/ManagerDialog.vue'

const DIALOG_KEY = 'global-manager'

// Caps live in `w-*`, not `max-w-*`: a `min-[3000px]:max-w-*` is emitted before
// the `sm:max-w-*` that `dialogContentVariants` adds, so it never wins.
// `sm:max-w-none` drops that variant cap, making `size: 'full'` inert here.
const MANAGER_CONTENT_CLASS =
  'w-[min(90vw,1724px)] min-[3000px]:w-[min(90vw,2200px)] sm:max-w-none h-[80vh] max-h-[1026px] min-[3000px]:max-h-[1320px] rounded-2xl overflow-hidden'

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
        renderer: 'reka',
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
