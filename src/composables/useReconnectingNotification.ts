import { useTimeoutFn } from '@vueuse/core'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'

const RECONNECT_TOAST_DELAY_MS = 1500

export function useReconnectingNotification() {
  const { t } = useI18n()
  const toast = useToast()
  const settingStore = useSettingStore()

  const reconnectingMessage: ToastMessageOptions = {
    severity: 'error',
    summary: t('g.reconnecting')
  }

  const reconnectingToastShown = ref(false)

  const { start, stop } = useTimeoutFn(
    () => {
      toast.add(reconnectingMessage)
      reconnectingToastShown.value = true
    },
    RECONNECT_TOAST_DELAY_MS,
    { immediate: false }
  )

  function onReconnecting() {
    if (settingStore.get('Comfy.Toast.DisableReconnectingToast')) return
    start()
  }

  function onReconnected() {
    stop()

    if (reconnectingToastShown.value) {
      toast.remove(reconnectingMessage)
      toast.add({
        severity: 'success',
        summary: t('g.reconnected'),
        life: 2000
      })
      reconnectingToastShown.value = false
    }
  }

  return { onReconnecting, onReconnected }
}
