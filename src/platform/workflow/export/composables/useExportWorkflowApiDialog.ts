import { t } from '@/i18n'
import ExportWorkflowApiDialogContent from '@/platform/workflow/export/components/ExportWorkflowApiDialogContent.vue'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-export-workflow-api'

export function useExportWorkflowApiDialog() {
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show() {
    dialogStore.showDialog({
      key: DIALOG_KEY,
      title: t('apiExport.title'),
      component: ExportWorkflowApiDialogContent,
      props: { onClose: hide },
      dialogComponentProps: {
        renderer: 'reka',
        size: 'md'
      }
    })
  }

  return { show, hide }
}
