import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-share-workflow'

export function useShareDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ShareWorkflowDialogContent,
      props: {
        onClose: hide
      },
      dialogComponentProps: {
        pt: {
          root: {
            class: 'rounded-2xl overflow-hidden w-full sm:w-144 max-w-full'
          }
        }
      }
    })
  }

  return {
    show,
    hide
  }
}
