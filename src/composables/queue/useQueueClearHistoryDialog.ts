import QueueClearHistoryDialog from '@/components/queue/dialogs/QueueClearHistoryDialog.vue'
import { useDialogStore } from '@/stores/dialogStore'

export const useQueueClearHistoryDialog = () => {
  const dialogStore = useDialogStore()

  const showQueueClearHistoryDialog = () => {
    dialogStore.showDialog({
      key: 'queue-clear-history',
      component: QueueClearHistoryDialog,
      dialogComponentProps: {
        headless: true,
        closable: false,
        closeOnEscape: true,
        dismissableMask: true,
        // The content draws its own panel — neutralize the chrome box.
        contentClass: 'w-fit max-w-90 border-none bg-transparent shadow-none'
      }
    })
  }

  return {
    showQueueClearHistoryDialog
  }
}
