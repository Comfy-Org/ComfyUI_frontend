import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import EmptyWorkflowDialogContent from './EmptyWorkflowDialogContent.vue'

const DIALOG_KEY = 'builder-empty-workflow'

export function useEmptyWorkflowDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const templateSelectorDialog = useWorkflowTemplateSelectorDialog()

  function show(options: {
    onEnterBuilder: () => void
    onDismiss: () => void
  }) {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: EmptyWorkflowDialogContent,
      props: {
        onBackToWorkflow: () => {
          closeDialog()
          options.onDismiss()
        },
        onLoadTemplate: () => {
          closeDialog()
          templateSelectorDialog.show('appbuilder', {
            afterClose: () => {
              if (app.rootGraph?.nodes?.length) options.onEnterBuilder()
            }
          })
        }
      }
    })
  }

  function closeDialog() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return { show }
}
