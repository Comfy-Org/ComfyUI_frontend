import { useDialogService } from '@/services/dialogService'
import type { DialogComponentProps } from '@/stores/dialogStore'
import { useDialogStore } from '@/stores/dialogStore'
import ImportFailedNodeContent from '@/platform/customNodes/manager/components/manager/ImportFailedNodeContent.vue'
import ImportFailedNodeFooter from '@/platform/customNodes/manager/components/manager/ImportFailedNodeFooter.vue'
import ImportFailedNodeHeader from '@/platform/customNodes/manager/components/manager/ImportFailedNodeHeader.vue'
import type { ConflictDetectionResult } from '@/platform/customNodes/manager/types/conflictDetectionTypes'

const DIALOG_KEY = 'global-import-failed'

export function useImportFailedNodeDialog() {
  const { showSmallLayoutDialog } = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(
    options: {
      conflictedPackages?: ConflictDetectionResult[]
      dialogComponentProps?: DialogComponentProps
    } = {}
  ) {
    const { dialogComponentProps, conflictedPackages = [] } = options

    showSmallLayoutDialog({
      key: DIALOG_KEY,
      headerComponent: ImportFailedNodeHeader,
      footerComponent: ImportFailedNodeFooter,
      component: ImportFailedNodeContent,
      dialogComponentProps,
      props: {
        conflictedPackages
      },
      footerProps: {
        conflictedPackages
      }
    })
  }

  return { show, hide }
}
