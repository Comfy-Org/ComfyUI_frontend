import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDialogService } from '@/services/dialogService'
import { useAppModeStore } from '@/stores/appModeStore'
import { useDialogStore } from '@/stores/dialogStore'
import { ref } from 'vue'

import { setWorkflowDefaultView } from './builderViewOptions'
import BuilderSaveDialogContent from './BuilderSaveDialogContent.vue'

const SAVE_DIALOG_KEY = 'builder-save'
const SUCCESS_DIALOG_KEY = 'builder-save-success'

const isSaving = ref(false)

export function useBuilderSave() {
  const { toastErrorHandler } = useErrorHandling()
  const { setMode } = useAppMode()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const dialogService = useDialogService()
  const appModeStore = useAppModeStore()
  const dialogStore = useDialogStore()

  function closeDialog(key: string) {
    dialogStore.closeDialog({ key })
  }

  async function save() {
    if (isSaving.value) return
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return

    isSaving.value = true
    try {
      await workflowService.saveWorkflow(workflow)
      showSuccessDialog()
    } catch (e) {
      toastErrorHandler(e)
    } finally {
      isSaving.value = false
    }
  }

  function saveAs() {
    if (isSaving.value) return
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return

    dialogService.showLayoutDialog({
      key: SAVE_DIALOG_KEY,
      component: BuilderSaveDialogContent,
      props: {
        defaultFilename: workflow.filename,
        defaultOpenAsApp: workflow.initialMode !== 'graph',
        onSave: handleSaveAs,
        onClose: () => closeDialog(SAVE_DIALOG_KEY)
      }
    })
  }

  async function handleSaveAs(filename: string, openAsApp: boolean) {
    if (isSaving.value) return
    isSaving.value = true
    try {
      const workflow = workflowStore.activeWorkflow
      if (!workflow) return

      const saved = await workflowService.saveWorkflowAs(workflow, {
        filename
      })

      if (!saved) return
      const activeWorkflow = workflowStore.activeWorkflow
      if (!activeWorkflow) return
      setWorkflowDefaultView(activeWorkflow, openAsApp)
      closeDialog(SAVE_DIALOG_KEY)
      showSuccessDialog(openAsApp ? 'app' : 'graph')
    } catch (e) {
      toastErrorHandler(e)
      closeDialog(SAVE_DIALOG_KEY)
    } finally {
      isSaving.value = false
    }
  }

  function showSuccessDialog(viewType?: 'app' | 'graph') {
    const promptText =
      viewType === 'app'
        ? t('builderSave.successBodyApp')
        : viewType === 'graph'
          ? t('builderSave.successBodyGraph')
          : t('builderSave.successBody')

    showConfirmDialog({
      key: SUCCESS_DIALOG_KEY,
      headerProps: {
        title: t('builderSave.successTitle'),
        icon: 'icon-[lucide--circle-check-big] text-green-500'
      },
      props: { promptText, preserveNewlines: true },
      footerProps:
        viewType === 'graph'
          ? {
              cancelText: t('builderToolbar.viewApp'),
              confirmText: t('linearMode.builder.exit'),
              confirmVariant: 'secondary' as const,
              onCancel: () => {
                closeDialog(SUCCESS_DIALOG_KEY)
                useTelemetry()?.trackEnterLinear({ source: 'app_builder' })
                setMode('app')
              },
              onConfirm: () => {
                closeDialog(SUCCESS_DIALOG_KEY)
                appModeStore.exitBuilder()
              }
            }
          : {
              cancelText: t('g.close'),
              confirmText: t('builderToolbar.viewApp'),
              confirmVariant: 'secondary' as const,
              onCancel: () => closeDialog(SUCCESS_DIALOG_KEY),
              onConfirm: () => {
                closeDialog(SUCCESS_DIALOG_KEY)
                useTelemetry()?.trackEnterLinear({ source: 'app_builder' })
                setMode('app')
              }
            }
    })
  }

  return { save, saveAs, isSaving }
}
