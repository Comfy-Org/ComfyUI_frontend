import NodeConflictDialogContent from '@/workbench/extensions/manager/components/manager/NodeConflictDialogContent.vue'
import NodeConflictFooter from '@/workbench/extensions/manager/components/manager/NodeConflictFooter.vue'
import NodeConflictHeader from '@/workbench/extensions/manager/components/manager/NodeConflictHeader.vue'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'
import type { DialogComponentProps } from '@/stores/dialogStore'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'

const DIALOG_KEY = 'global-node-conflict'

export const useNodeConflictDialog = () => {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(
    options: {
      showAfterWhatsNew?: boolean
      conflictedPackages?: ConflictDetectionResult[]
      dialogComponentProps?: DialogComponentProps
      buttonText?: string
      onButtonClick?: () => void
    } = {}
  ) {
    const { buttonText, onButtonClick, showAfterWhatsNew, conflictedPackages } =
      options

    return dialogService.showSmallDialog({
      key: DIALOG_KEY,
      headerComponent: NodeConflictHeader,
      footerComponent: NodeConflictFooter,
      component: NodeConflictDialogContent,
      props: {
        showAfterWhatsNew,
        conflictedPackages
      },
      footerProps: {
        buttonText,
        onButtonClick
      }
    })
  }

  return { show, hide }
}
