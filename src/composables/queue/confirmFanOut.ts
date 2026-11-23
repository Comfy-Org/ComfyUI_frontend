import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogStore } from '@/stores/dialogStore'

export const FAN_OUT_CONFIRM_THRESHOLD = 5

const FAN_OUT_CONFIRM_DIALOG_KEY = 'queue-fan-out-confirm'

function askToFanOut(count: number): Promise<boolean> {
  const dialogStore = useDialogStore()
  return new Promise((resolve) => {
    const settle = (confirmed: boolean) => {
      resolve(confirmed)
      dialogStore.closeDialog({ key: FAN_OUT_CONFIRM_DIALOG_KEY })
    }
    showConfirmDialog({
      key: FAN_OUT_CONFIRM_DIALOG_KEY,
      headerProps: { title: t('queueStatus.fanOutConfirmTitle', { count }) },
      props: { promptText: t('queueStatus.fanOutConfirmMessage') },
      footerProps: {
        cancelText: t('g.cancel'),
        confirmText: t('queueStatus.fanOutConfirmAction', { count }),
        confirmVariant: 'primary',
        onCancel: () => settle(false),
        onConfirm: () => settle(true)
      },
      onRemoved: () => resolve(false)
    })
  })
}

export async function confirmFanOutIfNeeded(
  batchCount: number
): Promise<boolean> {
  const guarded =
    useSettingStore().get('Comfy.Queue.StatusToast') &&
    batchCount >= FAN_OUT_CONFIRM_THRESHOLD
  return guarded ? askToFanOut(batchCount) : true
}
