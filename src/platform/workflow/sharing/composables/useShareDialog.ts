import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'
import { useShareFlowContext } from '@/platform/workflow/sharing/composables/useShareFlowContext'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useWorkflowStore } from '../../management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { t } from '@/i18n'

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
    const linearData = wf.changeTracker?.activeState?.extra?.linearData
    const { outputs } = pruneLinearData(linearData, app.rootGraph)

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
      },
      dialogComponentProps: {
        contentClass: 'sm:max-w-144 rounded-2xl overflow-hidden'
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
