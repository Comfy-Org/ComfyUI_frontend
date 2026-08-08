import { t } from '@/i18n'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-export-workflow-api'

export async function openExportWorkflowApiDialog() {
  const { default: component } =
    await import('@/platform/workflow/export/components/ExportWorkflowApiDialogContent.vue')
  const dialogStore = useDialogStore()
  const close = () => dialogStore.closeDialog({ key: DIALOG_KEY })

  dialogStore.showDialog({
    key: DIALOG_KEY,
    title: t('apiExport.title'),
    component,
    props: { onClose: close },
    dialogComponentProps: { renderer: 'reka', size: 'md' }
  })
}
