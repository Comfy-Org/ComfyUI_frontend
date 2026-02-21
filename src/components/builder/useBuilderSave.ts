import { watch } from 'vue'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'
import { useAppModeStore } from '@/stores/appModeStore'
import { useDialogStore } from '@/stores/dialogStore'

import BuilderSaveDialogContent from './BuilderSaveDialogContent.vue'
import BuilderSaveSuccessDialogContent from './BuilderSaveSuccessDialogContent.vue'

const SAVE_DIALOG_KEY = 'builder-save'
const SUCCESS_DIALOG_KEY = 'builder-save-success'

export function useBuilderSave() {
  const appModeStore = useAppModeStore()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  watch(
    () => appModeStore.isBuilderSaving,
    (saving) => {
      if (saving) void onBuilderSave()
    }
  )

  async function onBuilderSave() {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) {
      resetSaving()
      return
    }

    // TODO: Update this to show the save dialog if it is temp OR if the user has not saved app mode before.
    // If they have saved app mode before, just save the workflow, but use the initial app mode state not current.

    if (!workflow.isTemporary) {
      try {
        workflow.changeTracker?.checkState()
        await workflowService.saveWorkflow(workflow)
        showSuccessDialog(workflow.filename, appModeStore.isAppMode)
      } catch {
        resetSaving()
      }
      return
    }

    showSaveDialog(workflow.filename)
  }

  function showSaveDialog(defaultFilename: string) {
    dialogService.showLayoutDialog({
      key: SAVE_DIALOG_KEY,
      component: BuilderSaveDialogContent,
      props: {
        defaultFilename,
        onSave: handleSave,
        onClose: handleCancelSave
      },
      dialogComponentProps: {
        onClose: resetSaving
      }
    })
  }

  function handleCancelSave() {
    closeSaveDialog()
    resetSaving()
  }

  async function handleSave(filename: string, openAsApp: boolean) {
    try {
      const workflow = workflowStore.activeWorkflow
      if (!workflow) return

      const saved = await workflowService.saveWorkflowAs(workflow, {
        filename,
        openAsApp
      })

      if (!saved) return

      closeSaveDialog()
      showSuccessDialog(filename, openAsApp)
    } catch {
      closeSaveDialog()
      resetSaving()
    }
  }

  function showSuccessDialog(workflowName: string, savedAsApp: boolean) {
    dialogService.showLayoutDialog({
      key: SUCCESS_DIALOG_KEY,
      component: BuilderSaveSuccessDialogContent,
      props: {
        workflowName,
        savedAsApp,
        onViewApp: () => {
          appModeStore.setMode('app')
          closeSuccessDialog()
        },
        onClose: closeSuccessDialog
      },
      dialogComponentProps: {
        onClose: resetSaving
      }
    })
  }

  function closeSaveDialog() {
    dialogStore.closeDialog({ key: SAVE_DIALOG_KEY })
  }

  function closeSuccessDialog() {
    dialogStore.closeDialog({ key: SUCCESS_DIALOG_KEY })
    resetSaving()
  }

  function resetSaving() {
    appModeStore.setBuilderSaving(false)
  }
}
