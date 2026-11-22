import { useSettingStore } from '@/platform/settings/settingStore'
import WorkflowTemplateSelectorDialog from '@/platform/workflow/templates/components/WorkflowTemplateSelectorDialog.vue'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { TemplateLibraryMetadata } from '@comfyorg/telemetry/types'
import { useDialogService } from '@/services/dialogService'
import { useNewUserService } from '@/services/useNewUserService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-workflow-template-selector'
const POPULAR_CATEGORY_ID = 'popular'
const ALL_CATEGORY_ID = 'all'

export const useWorkflowTemplateSelectorDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const newUserService = useNewUserService()
  const settingStore = useSettingStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(
    source: TemplateLibraryMetadata['source'] = 'command',
    options?: { initialCategory?: string; afterClose?: () => void }
  ) {
    useTelemetry()?.trackTemplateLibraryOpened({ source })

    const hasOpenedLibrary = settingStore.get(
      'Comfy.Templates.HasOpenedLibrary'
    )
    const isFirstOpenForNewUser =
      newUserService.isNewUser() === true && !hasOpenedLibrary
    const initialCategory =
      options?.initialCategory ??
      (isFirstOpenForNewUser ? POPULAR_CATEGORY_ID : ALL_CATEGORY_ID)

    if (!hasOpenedLibrary) {
      settingStore
        .set('Comfy.Templates.HasOpenedLibrary', true)
        .catch((error: unknown) =>
          reportError(error, {
            surface: 'platform',
            errorType: 'failure_writing_templates_opened_library_setting',
            level: 'warning'
          })
        )
    }

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
