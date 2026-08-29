import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import CustomNodeEditorDialog from '../components/CustomNodeEditorDialog.vue'
import type { CustomNodeEditorSession } from './useCustomNodeEditor'

const DIALOG_KEY = 'custom-node-editor'

export function useCustomNodeEditorDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  const hide = () => dialogStore.closeDialog({ key: DIALOG_KEY })

  const show = (
    session: CustomNodeEditorSession,
    onSubmitted: () => void | Promise<void>
  ) => {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: CustomNodeEditorDialog,
      props: { initialSession: session, onClose: hide, onSubmitted },
      dialogComponentProps: {
        renderer: 'reka',
        headless: true,
        modal: true,
        maximized: true,
        closable: false,
        closeOnEscape: false,
        dismissableMask: false,
        dismissOnFocusOutside: false,
        contentClass:
          'inset-0 min-h-0 min-w-0 overflow-hidden rounded-none border-0 p-0'
      }
    })
  }

  return { show, hide }
}
