import PublishTemplateWizard from '@/platform/marketplace/components/PublishTemplateWizard.vue'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'publish-to-marketplace'

export function usePublishDialog() {
  const dialogStore = useDialogStore()

  function show() {
    dialogStore.showDialog({
      key: DIALOG_KEY,
      title: 'Publish to Marketplace',
      component: PublishTemplateWizard,
      dialogComponentProps: {
        onClose: hide,
        pt: {
          header: 'py-0! pl-0!',
          content: 'p-0! overflow-y-hidden!'
        }
      }
    })
  }

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return { show, hide }
}
