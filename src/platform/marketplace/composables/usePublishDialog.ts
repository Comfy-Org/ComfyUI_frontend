import type { MarketplaceTemplate } from '@/platform/marketplace/apiTypes'

import PublishTemplateWizard from '@/platform/marketplace/components/PublishTemplateWizard.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'publish-to-marketplace'

export function usePublishDialog() {
  const dialogService = useDialogService()
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
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: PublishTemplateWizard,
      props: {
        onClose: handleClose,
        initialTemplate: options?.initialTemplate,
        readOnly: options?.readOnly
      }
    })
  }

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return { show, hide }
}
