import ComfyHubPublishDialog from '@/platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-comfyhub-publish'

/** Reka's default `md` frame is 576px — too narrow for this 1400px layout. */
const PUBLISH_CONTENT_CLASS =
  'w-[90vw] max-w-[1400px] sm:max-w-[1400px] h-[80vh] rounded-2xl overflow-hidden'

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
      },
      dialogComponentProps: {
        size: 'full',
        contentClass: PUBLISH_CONTENT_CLASS
      }
    })
  }

  return {
    show,
    hide
  }
}
