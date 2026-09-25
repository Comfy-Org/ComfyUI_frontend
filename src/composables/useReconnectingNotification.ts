import { useDocumentVisibility, useTimeoutFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast'
import type { ToastId } from '@/components/ui/toast'
import { useSettingStore } from '@/platform/settings/settingStore'

const RECONNECT_TOAST_DELAY_MS = 2000
// Backgrounded-tab timer throttling can let disconnect and reconnect both fire right as the tab regains focus, racing past RECONNECT_TOAST_DELAY_MS, so use a longer delay during the grace window below.
const VISIBILITY_REGAINED_TOAST_DELAY_MS = 5000
const VISIBILITY_REGAINED_GRACE_MS = 10000

export function useReconnectingNotification() {
  const { t } = useI18n()
  const toast = useToast()
  const settingStore = useSettingStore()

  const toastDelayMs = ref(RECONNECT_TOAST_DELAY_MS)
  const reconnectingToastId = ref<ToastId>()

  const { start, stop, isPending } = useTimeoutFn(
    () => {
      reconnectingToastId.value = toast.error(t('g.reconnecting'))
    },
    toastDelayMs,
    { immediate: false }
  )

  const { start: startGracePeriod } = useTimeoutFn(
    () => {
      toastDelayMs.value = RECONNECT_TOAST_DELAY_MS
    },
    VISIBILITY_REGAINED_GRACE_MS,
    { immediate: false }
  )

  const visibility = useDocumentVisibility()
  watch(visibility, (state) => {
    if (state !== 'visible') return

    toastDelayMs.value = VISIBILITY_REGAINED_TOAST_DELAY_MS
    startGracePeriod()

    if (isPending.value) start()
  })

  function onReconnecting() {
    if (settingStore.get('Comfy.Toast.DisableReconnectingToast')) return
    start()
  }

  function onReconnected() {
    stop()

    if (reconnectingToastId.value !== undefined) {
      toast.dismiss(reconnectingToastId.value)
      toast.success(t('g.reconnected'), { duration: 2000 })
      reconnectingToastId.value = undefined
    }
  }

  return { onReconnecting, onReconnected }
}
