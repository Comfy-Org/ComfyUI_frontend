import DeveloperProfileDialog from '@/components/developerProfile/DeveloperProfileDialog.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-developer-profile'

/**
 * Manages the lifecycle of the developer profile dialog.
 *
 * @returns `show` to open the dialog for a given username, and `hide` to close it.
 */
export function useDeveloperProfileDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(username?: string) {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: DeveloperProfileDialog,
      props: {
        onClose: hide,
        username
      }
    })
  }

  return { show, hide }
}
