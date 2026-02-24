import TemplatePublishingDialog from '@/components/templatePublishing/TemplatePublishingDialog.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-template-publishing'

/**
 * Manages the lifecycle of the template publishing dialog.
 *
 * @returns `show` to open the dialog and `hide` to close it.
 */
export const useTemplatePublishingDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(options?: { initialPage?: string }) {
    // comeback need a new telemetry for this
    // useTelemetry()?.trackTemplatePublishingOpened({ source })

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: TemplatePublishingDialog,
      props: {
        onClose: hide,
        initialPage: options?.initialPage
      }
    })
  }

  return {
    show,
    hide
  }
}
