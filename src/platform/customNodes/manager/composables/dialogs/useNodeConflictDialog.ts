import { useDialogService } from '@/services/dialogService'
import type { DialogComponentProps } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'
import NodeConflictDialogContent from '@/platform/customNodes/manager/components/manager/NodeConflictDialogContent.vue'
import NodeConflictFooter from '@/platform/customNodes/manager/components/manager/NodeConflictFooter.vue'
import NodeConflictHeader from '@/platform/customNodes/manager/components/manager/NodeConflictHeader.vue'
import type { ConflictDetectionResult } from '@/platform/customNodes/manager/types/conflictDetectionTypes'

const DIALOG_KEY = 'global-node-conflict'

export function useNodeConflictDialog() {
  const { showSmallLayoutDialog } = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(
    options: {
      buttonText?: string
      conflictedPackages?: ConflictDetectionResult[]
      dialogComponentProps?: DialogComponentProps
      onButtonClick?: () => void
      showAfterWhatsNew?: boolean
    } = {}
  ) {
    const {
      dialogComponentProps,
      buttonText,
      onButtonClick,
      showAfterWhatsNew,
      conflictedPackages
    } = options

    showSmallLayoutDialog({
      key: DIALOG_KEY,
      headerComponent: NodeConflictHeader,
      footerComponent: NodeConflictFooter,
      component: NodeConflictDialogContent,
      dialogComponentProps,
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
