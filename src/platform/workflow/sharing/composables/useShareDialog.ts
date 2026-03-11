import ShareWorkflowDialogContent from '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue'
import { useAppMode } from '@/composables/useAppMode'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import { useWorkflowStore } from '../../management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { t } from '@/i18n'

const DIALOG_KEY = 'global-share-workflow'

export function useShareDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { pruneLinearData } = useAppModeStore()
  const workflowStore = useWorkflowStore()
  const { isAppMode } = useAppMode()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function showNoOutputsDialogIfRequired(share: () => void) {
    const wf = workflowStore.activeWorkflow
    if (!wf) return share()

    const isAppDefault = wf.initialMode === 'app'
    const linearData = wf.changeTracker?.activeState?.extra?.linearData
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

  function getShareSource() {
    return isAppMode.value ? 'app_mode' : ('graph_mode' as const)
  }

  function showShareDialog() {
    useTelemetry()?.trackShareFlow({
      step: 'dialog_opened',
      source: getShareSource()
    })
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ShareWorkflowDialogContent,
      props: {
        onClose: hide
      },
      dialogComponentProps: {
        pt: {
          root: {
            class: 'rounded-2xl overflow-hidden w-full sm:w-144 max-w-full'
          }
        }
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
