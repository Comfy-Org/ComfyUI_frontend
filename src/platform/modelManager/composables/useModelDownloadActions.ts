import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useModelDownloadStore } from '../stores/modelDownloadStore'
import type { DownloadStatus } from '../types'
import { DownloadApiError } from '../types'

/**
 * Wraps download store mutations with user feedback: optimistic-friendly error
 * toasts and a confirmation prompt for the destructive cancel action (which
 * deletes the partial file).
 */
export function useModelDownloadActions() {
  const store = useModelDownloadStore()
  const dialogStore = useDialogStore()
  const { t } = useI18n()

  function toastError(error: unknown) {
    const detail =
      error instanceof DownloadApiError || error instanceof Error
        ? error.message
        : String(error)
    useToastStore().add({
      severity: 'error',
      summary: t('modelManager.actionFailed'),
      detail,
      life: 5000
    })
  }

  async function run(action: () => Promise<void>) {
    try {
      await action()
    } catch (error) {
      toastError(error)
      // The store applies optimistic status/priority patches before the API
      // call; re-fetch the authoritative state so a failed mutation doesn't
      // leave the row stuck in the wrong local state.
      try {
        await store.hydrate()
      } catch {
        // Server unreachable; the next poll will reconcile.
      }
    }
  }

  const pause = (download: DownloadStatus) =>
    run(() => store.pause(download.download_id))

  const resume = (download: DownloadStatus) =>
    run(() => store.resume(download.download_id))

  const raisePriority = (download: DownloadStatus, delta: number) =>
    run(() =>
      store.setPriority(download.download_id, download.priority + delta)
    )

  const remove = (download: DownloadStatus) =>
    run(() => store.remove(download.download_id))

  const clearHistory = () => run(() => store.clearHistory())

  function cancel(download: DownloadStatus) {
    const dialog = showConfirmDialog({
      headerProps: { title: t('modelManager.cancelConfirmTitle') },
      props: {
        promptText: t(
          'modelManager.cancelConfirmMessage',
          { name: download.model_id },
          { escapeParameter: false }
        )
      },
      footerProps: {
        confirmText: t('modelManager.cancelConfirm'),
        confirmVariant: 'destructive' as const,
        onCancel: () => dialogStore.closeDialog(dialog),
        onConfirm: async () => {
          dialogStore.closeDialog(dialog)
          await run(() => store.cancel(download.download_id))
        }
      }
    })
  }

  return {
    pause,
    resume,
    cancel,
    raisePriority,
    remove,
    clearHistory,
    toastError
  }
}
