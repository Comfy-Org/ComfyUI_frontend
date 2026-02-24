import { h } from 'vue'

import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-workflow-template-selector'
// const GETTING_STARTED_CATEGORY_ID = 'basics-getting-started' // comeback when there are tabs to pick between, or remove if they're fundamentally ordered

export const useTemplateMarketplaceDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(options?: { initialPage?: string }) {
    // comeback need a new telemetry for this
    // useTelemetry()?.trackTemplateLibraryOpened({ source })

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: () => h('div', 'Placeholder comeback'),
      //    component: TemplateMarketplaceDialog,
      props: {
        onClose: hide,
        initialPage: options?.initialPage
      }
    })
  }

  return {
    show,
    hide
  }
}
