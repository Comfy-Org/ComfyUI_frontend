import WorkflowTemplateSelectorDialog from '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
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
  const { flags } = useFeatureFlags()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function newUserDefaultCategory() {
    return flags.newUserDefaultTemplateTab ?? GETTING_STARTED_CATEGORY_ID
  }

  function show(
    source: TemplateLibraryMetadata['source'] = 'command',
    options?: { initialCategory?: string; afterClose?: () => void }
  ) {
    useTelemetry()?.trackTemplateLibraryOpened({ source })

    const initialCategory =
      options?.initialCategory ??
      (newUserService.isNewUser() ? newUserDefaultCategory() : 'all')

    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: WorkflowTemplateSelectorDialog,
      props: {
        onClose: () => {
          hide()
          options?.afterClose?.()
        },
        initialCategory
      }
    })
  }

  return {
    show,
    hide
  }
}
