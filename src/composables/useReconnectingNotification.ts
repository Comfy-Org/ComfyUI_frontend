import { useDocumentVisibility, useTimeoutFn } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { createToastId } from '@/types/toastId'
import { useSettingStore } from '@/platform/settings/settingStore'

const RECONNECT_TOAST_DELAY_MS = 2000
// Backgrounded-tab timer throttling can let disconnect and reconnect both fire right as the tab regains focus, racing past RECONNECT_TOAST_DELAY_MS, so use a longer delay during the grace window below.
const VISIBILITY_REGAINED_TOAST_DELAY_MS = 5000
const VISIBILITY_REGAINED_GRACE_MS = 10000

export function useReconnectingNotification() {
  const { t } = useI18n()
  const toast = useToast()
  const settingStore = useSettingStore()
  const { handleSignOut, onUserLogout } = useCurrentUser()

  const toastDelayMs = ref(RECONNECT_TOAST_DELAY_MS)
  const reconnectingToastId = createToastId()
  const sessionRevokedToastId = createToastId()

  const { start, stop, isPending } = useTimeoutFn(
    () => {
      toast.error(t('g.reconnecting'), { id: reconnectingToastId })
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

  onUserLogout(() => toast.dismiss(sessionRevokedToastId))

  function onReconnecting() {
    if (settingStore.get('Comfy.Toast.DisableReconnectingToast')) return
    start()
  }

  function onReconnected() {
    stop()
    toast.dismiss(sessionRevokedToastId)

    if (toast.dismiss(reconnectingToastId)) {
      toast.success(t('g.reconnected'), { duration: 2000 })
    }
  }

  function onRevokedSocketEnded() {
    stop()
    toast.dismiss(reconnectingToastId)
    toast.error(t('g.sessionRevoked'), {
      id: sessionRevokedToastId,
      action: { label: t('auth.signOut.signOut'), onClick: handleSignOut }
    })
  }

  return { onReconnecting, onReconnected, onRevokedSocketEnded }
}
