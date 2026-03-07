import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import BuilderDefaultModeAppliedDialogContent from './BuilderDefaultModeAppliedDialogContent.vue'
import DefaultViewDialogContent from './DefaultViewDialogContent.vue'
import { useAppModeStore } from '@/stores/appModeStore'

const DIALOG_KEY = 'builder-default-view'
const APPLIED_DIALOG_KEY = 'builder-default-view-applied'

export function useAppSetDefaultView() {
  const workflowStore = useWorkflowStore()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const appModeStore = useAppModeStore()
  const { setMode } = useAppMode()

  const settingView = computed(() => dialogStore.isDialogOpen(DIALOG_KEY))

  function showDialog() {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: DefaultViewDialogContent,
      props: {
        initialOpenAsApp: workflowStore.activeWorkflow?.initialMode !== 'graph',
        onApply: handleApply,
        onClose: closeDialog
      }
    })
  }

  function handleApply(openAsApp: boolean) {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return

    workflow.initialMode = openAsApp ? 'app' : 'graph'
    const extra = (app.rootGraph.extra ??= {})
    extra.linearMode = openAsApp
    workflow.changeTracker?.checkState()
    closeDialog()
    showAppliedDialog(openAsApp)
  }

  function showAppliedDialog(appliedAsApp: boolean) {
    dialogService.showLayoutDialog({
      key: APPLIED_DIALOG_KEY,
      component: BuilderDefaultModeAppliedDialogContent,
      props: {
        appliedAsApp,
        onViewApp: () => {
          closeAppliedDialog()
          setMode('app')
        },
        onExitToWorkflow: () => {
          closeAppliedDialog()
          appModeStore.exitBuilder()
        },
        onClose: closeAppliedDialog
      }
    })
  }

  function closeDialog() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function closeAppliedDialog() {
    dialogStore.closeDialog({ key: APPLIED_DIALOG_KEY })
  }

  return { settingView, showDialog }
}
