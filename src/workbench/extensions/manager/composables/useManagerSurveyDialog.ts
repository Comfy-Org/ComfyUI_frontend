import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import ManagerSurveyDialog from '@/workbench/extensions/manager/components/survey/ManagerSurveyDialog.vue'

const DIALOG_KEY = 'global-manager-survey'

export function useManagerSurveyDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ManagerSurveyDialog,
      props: {
        onClose: hide
      },
      dialogComponentProps: {
        contentClass: 'w-full sm:max-w-lg rounded-2xl overflow-hidden'
      }
    })
  }

  return {
    show,
    hide
  }
}
