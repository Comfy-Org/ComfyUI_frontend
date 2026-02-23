import { ref, watch } from 'vue'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'
import { useAppMode } from '@/composables/useAppMode'
import { useDialogStore } from '@/stores/dialogStore'

import BuilderSaveDialogContent from './BuilderSaveDialogContent.vue'
import BuilderSaveSuccessDialogContent from './BuilderSaveSuccessDialogContent.vue'

const SAVE_DIALOG_KEY = 'builder-save'
const SUCCESS_DIALOG_KEY = 'builder-save-success'

export function useBuilderSave() {
  const { isAppMode, setMode } = useAppMode()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  const saving = ref(false)

  watch(saving, (value) => {
    if (value) void onBuilderSave()
  })

  function setSaving(value: boolean) {
    saving.value = value
  }

  async function onBuilderSave() {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) {
      resetSaving()
      return
    }

    if (!workflow.isTemporary && workflow.activeState.extra?.linearMode) {
      try {
        workflow.changeTracker?.checkState()
        appModeStore.saveSelectedToWorkflow()
        await workflowService.saveWorkflow(workflow)
        showSuccessDialog(workflow.filename, isAppMode.value)
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

      appModeStore.saveSelectedToWorkflow()
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
          setMode('app')
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
    saving.value = false
  }

  return { saving, setSaving }
}
