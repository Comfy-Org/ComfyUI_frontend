import type { MarketplaceTemplate } from '@/platform/marketplace/apiTypes'

import PublishTemplateWizard from '@/platform/marketplace/components/PublishTemplateWizard.vue'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'publish-to-marketplace'

export function usePublishDialog() {
  const dialogStore = useDialogStore()

  function show(options?: {
    initialTemplate?: MarketplaceTemplate
    readOnly?: boolean
    onClose?: () => void
  }) {
    const handleClose = () => {
      options?.onClose?.()
      hide()
    }
    dialogStore.showDialog({
      key: DIALOG_KEY,
      title: options?.readOnly ? 'Template Details' : 'Publish to Marketplace',
      component: PublishTemplateWizard,
      props: {
        onClose: handleClose,
        initialTemplate: options?.initialTemplate,
        readOnly: options?.readOnly
      },
      dialogComponentProps: {
        class: 'min-w-[600px]',
        onClose: handleClose,
        pt: {
          header: 'p-5!',
          content: 'p-5! overflow-y-hidden!'
        }
      }
    })
  }

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return { show, hide }
}
