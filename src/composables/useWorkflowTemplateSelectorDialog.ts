import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import { useTelemetry } from '@/platform/telemetry'
import type { TemplateLibraryMetadata } from '@/platform/telemetry/types'
import { consumePreferAppTemplates } from '@/platform/workflow/templates/preferAppTemplates'
import type { TemplateContentType } from '@/schemas/apiSchema'
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
    options?: {
      initialCategory?: string
      initialContentType?: TemplateContentType
      afterClose?: () => void
    }
  ) {
    useTelemetry()?.trackTemplateLibraryOpened({ source })

    const initialCategory =
      options?.initialCategory ??
      (newUserService.isNewUser() ? GETTING_STARTED_CATEGORY_ID : 'all')

    const initialContentType =
      options?.initialContentType ??
      (consumePreferAppTemplates() ? 'app' : undefined)

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: WorkflowTemplateSelectorDialog,
      props: {
        onClose: () => {
          hide()
          options?.afterClose?.()
        },
        initialCategory,
        initialContentType
      }
    })
  }

  return {
    show,
    hide
  }
}
