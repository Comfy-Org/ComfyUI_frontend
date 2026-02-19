import ComfyHubPublishDialog from '@/platform/workflow/sharing/components/comfyhub/ComfyHubPublishDialog.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-comfyhub-publish'

export function useComfyHubPublishDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ComfyHubPublishDialog,
      props: {
        onClose: hide
      }
    })
  }

  return {
    show,
    hide
  }
}
