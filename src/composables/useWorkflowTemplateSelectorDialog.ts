import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-workflow-template-selector'

export const useWorkflowTemplateSelectorDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: WorkflowTemplateSelectorDialog,
      props: {
        onClose: hide
      },
      dialogComponentProps: {
        pt: {
          content: { class: '!px-0 overflow-hidden h-full !py-0' },
          root: {
            style:
              'width: 90vw; height: 85vh; max-width: 1400px; display: flex;'
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
