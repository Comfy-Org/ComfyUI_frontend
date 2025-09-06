import NewWorkflowTemplateSelectorDialog from '@/components/custom/widget/NewWorkflowTemplateSelectorDialog.vue'
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
      component: NewWorkflowTemplateSelectorDialog,
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
