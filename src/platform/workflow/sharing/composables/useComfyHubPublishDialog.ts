import { defineAsyncComponent } from 'vue'

import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-comfyhub-publish'

const ComfyHubPublishDialog = defineAsyncComponent(
  () =>
    import('@/platform/workflow/sharing/components/publish/ComfyHubPublishDialog.vue')
)

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

  /** Extension-facing entry point; also used by the e2e publish fixture. */
  async function showPublishDialog(): Promise<void> {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ComfyHubPublishDialog,
      props: {
        onClose: hide,
        // Falls through to the BaseModalLayout root for the e2e
        // publish-dialog selector.
        'data-testid': 'publish-dialog'
      }
    })
  }

  return {
    show,
    hide,
    showPublishDialog
  }
}
