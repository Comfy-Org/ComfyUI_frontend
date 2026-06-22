import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import { useTelemetry } from '@/platform/telemetry'
import type { TemplateLibraryMetadata } from '@/platform/telemetry/types'
import { useDialogService } from '@/services/dialogService'
import { useNewUserService } from '@/services/useNewUserService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-workflow-template-selector'
const GETTING_STARTED_CATEGORY_ID = 'basics-getting-started'

export const useWorkflowTemplateSelectorDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const newUserService = useNewUserService()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(
    source: TemplateLibraryMetadata['source'] = 'command',
    options?: { initialCategory?: string; afterClose?: () => void }
  ) {
    useTelemetry()?.trackTemplateLibraryOpened({ source })

    const initialCategory =
      options?.initialCategory ??
      (newUserService.isNewUser() ? GETTING_STARTED_CATEGORY_ID : 'all')

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: WorkflowTemplateSelectorDialog,
      props: {
        onClose: () => {
          hide()
          options?.afterClose?.()
        },
        initialCategory
      },
      // The template browser is a wide layout. Without an explicit size the
      // Reka DialogContent falls back to size 'md' (max-w-xl), clipping the
      // filter bar so the Clear Filters button lands outside the viewport.
      // Size it like the other large dialogs (Settings/Manager).
      dialogComponentProps: {
        size: 'full',
        contentClass:
          'w-[90vw] max-w-[1400px] sm:max-w-[1400px] h-[80vh] rounded-2xl overflow-hidden'
      }
    })
  }

  return {
    show,
    hide
  }
}
