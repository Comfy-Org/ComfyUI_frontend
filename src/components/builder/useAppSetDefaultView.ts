import { computed } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import DefaultViewDialogContent from './DefaultViewDialogContent.vue'

const DIALOG_KEY = 'builder-default-view'

export function useAppSetDefaultView() {
  const workflowStore = useWorkflowStore()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

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
    app.rootGraph.extra.linearMode = openAsApp
    workflow.changeTracker?.checkState()
    closeDialog()
  }

  function closeDialog() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  return { settingView, showDialog }
}
