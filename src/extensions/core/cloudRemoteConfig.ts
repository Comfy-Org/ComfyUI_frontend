import { watchDebounced } from '@vueuse/core'
import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { refreshFeatureGates } from '@/composables/useFeatureGate'
import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { useExtensionService } from '@/services/extensionService'

/**
 * Cloud-only extension that polls for remote config updates
 * Initial config load happens in main.ts before any other imports
 */
useExtensionService().registerExtension({
  name: 'Comfy.Cloud.RemoteConfig',

  setup: async () => {
    const { isLoggedIn, resolvedUserInfo } = useCurrentUser()
    const { isActiveSubscription } = useBillingContext()
    const refreshAuthenticatedConfig = async () => {
      await refreshRemoteConfig({
        getSessionId: () => resolvedUserInfo.value?.id ?? null
      })
      await refreshFeatureGates()
    }

    watch(
      resolvedUserInfo,
      (user, previousUser) => {
        if (user?.id !== previousUser?.id) {
          remoteConfigState.value = 'anonymous'
        }
      },
      { flush: 'sync' }
    )

    // Refresh config when auth or subscription status changes
    // Primary auth refresh is handled by WorkspaceAuthGate on mount
    // This watcher handles subscription changes and acts as a backup for auth
    watchDebounced(
      [isLoggedIn, resolvedUserInfo, isActiveSubscription],
      () => {
        if (!isLoggedIn.value) return
        void refreshAuthenticatedConfig()
      },
      { debounce: 256, immediate: true }
    )

    setInterval(() => {
      if (isLoggedIn.value) void refreshAuthenticatedConfig()
    }, 30_000)
  }
})
