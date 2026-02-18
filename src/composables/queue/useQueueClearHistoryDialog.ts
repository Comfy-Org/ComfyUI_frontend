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
        pt: {
          root: {
            class: 'max-w-[360px] w-auto bg-transparent border-none shadow-none'
          },
          content: {
            class: '!p-0 bg-transparent'
          }
        }
      }
    })
  }

  return {
    showQueueClearHistoryDialog
  }
}
