import AuthorDashboard from '@/platform/marketplace/components/AuthorDashboard.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'author-marketplace-dashboard'

export function useAuthorDashboardDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: AuthorDashboard,
      props: {
        onClose: hide
      }
    })
  }

  return { show, hide }
}
