import { useDocumentVisibility, useTimeoutFn } from '@vueuse/core'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'

const RECONNECT_TOAST_DELAY_MS = 2000
// A suspended/backgrounded tab throttles timers, so the disconnect that
// triggers `onReconnecting` and the reconnect that follows can both land in
// the instant the tab regains focus, racing past RECONNECT_TOAST_DELAY_MS.
// While that's happening, wait longer before surfacing the toast.
const VISIBILITY_REGAINED_TOAST_DELAY_MS = 5000
const VISIBILITY_REGAINED_GRACE_MS = 10000

export function useReconnectingNotification() {
  const { t } = useI18n()
  const toast = useToast()
  const settingStore = useSettingStore()

  const reconnectingMessage: ToastMessageOptions = {
    severity: 'error',
    summary: t('g.reconnecting')
  }

  const reconnectingToastShown = ref(false)
  const toastDelayMs = ref(RECONNECT_TOAST_DELAY_MS)

  const { start, stop, isPending } = useTimeoutFn(
    () => {
      toast.add(reconnectingMessage)
      reconnectingToastShown.value = true
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

    // A reconnecting toast queued while the tab was hidden may already be
    // overdue; restart it so it gets the full, extended delay from now.
    if (isPending.value) start()
  })

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
