import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import CustomNodePacksDialog from '../components/CustomNodePacksDialog.vue'

const DIALOG_KEY = 'custom-node-packs'

/** Opens the dialog for uploading and managing a workspace's custom node packs. */
export function useCustomNodePacksDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  const hide = () => dialogStore.closeDialog({ key: DIALOG_KEY })

  const show = () => {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: CustomNodePacksDialog,
      props: { onClose: hide },
      dialogComponentProps: {
        renderer: 'reka',
        modal: true,
        size: 'md',
        contentClass:
          'w-[680px] max-w-[90vw] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl sm:max-w-[680px]'
      }
    })
  }

  return { show, hide }
}
