import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import { useTelemetry } from '@/platform/telemetry'
import type { TemplateLibraryMetadata } from '@/platform/telemetry/types'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { useDialogService } from '@/services/dialogService'
import { useNewUserService } from '@/services/useNewUserService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-workflow-template-selector'
const POPULAR_CATEGORY_ID = 'popular'

export const useWorkflowTemplateSelectorDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const newUserService = useNewUserService()
  const workflowTemplatesStore = useWorkflowTemplatesStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(
    source: TemplateLibraryMetadata['source'] = 'command',
    options?: { initialCategory?: string; afterClose?: () => void }
  ) {
    useTelemetry()?.trackTemplateLibraryOpened({ source })

    const requestedCategory =
      options?.initialCategory ??
      (newUserService.isNewUser() ? POPULAR_CATEGORY_ID : 'all')
    const initialCategory = workflowTemplatesStore.isLoaded
      ? workflowTemplatesStore.resolveCategoryId(requestedCategory)
      : requestedCategory

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
