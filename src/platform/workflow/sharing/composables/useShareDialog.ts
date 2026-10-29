import { useTelemetry } from '@comfyorg/telemetry'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { t } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'
import { useShareFlowContext } from '@/platform/workflow/sharing/composables/useShareFlowContext'
import { useDialogService } from '@/services/dialogService'
import { useAppModeStore } from '@/stores/appModeStore'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'global-share-workflow'

export function useShareDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { pruneLinearData } = useAppModeStore()
  const workflowStore = useWorkflowStore()
  const shareFlowContext = useShareFlowContext()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function showNoOutputsDialogIfRequired(share: () => void) {
    const wf = workflowStore.activeWorkflow
    if (!wf) return share()

    const isAppDefault = wf.initialMode === 'app'
    const linearData = wf.changeTracker.activeState.extra?.linearData
    const { outputs } = pruneLinearData(linearData)

    if (isAppDefault && outputs.length === 0) {
      const dialog = showConfirmDialog({
        headerProps: {
          title: t('shareNoOutputs.title')
        },
        props: {
          promptText: t('shareNoOutputs.message'),
          preserveNewlines: true
        },
        footerProps: {
          cancelText: t('g.cancel'),
          confirmText: t('shareNoOutputs.shareAnyway'),
          confirmVariant: 'secondary',
          onCancel: () => dialogStore.closeDialog(dialog),
          onConfirm: () => {
            dialogStore.closeDialog(dialog)
            share()
          }
        }
      })
      return
    }

    share()
  }

  function showShareDialog() {
    useTelemetry()?.trackShareFlow({
      step: 'dialog_opened',
      ...shareFlowContext.value
    })
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ShareWorkflowDialogContent,
      props: {
        onClose: hide
      }
    })
  }

  function show() {
    showNoOutputsDialogIfRequired(showShareDialog)
  }

  return {
    show,
    hide
  }
}
