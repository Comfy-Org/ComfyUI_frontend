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
        dismissOnPointerDownOutside: true
      }
    })
  }

  return {
    showQueueClearHistoryDialog
  }
}
