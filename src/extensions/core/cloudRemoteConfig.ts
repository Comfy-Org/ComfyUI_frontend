import { watchDebounced } from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { useExtensionService } from '@/services/extensionService'

/**
 * Cloud-only extension that polls for remote config updates
 * Initial config load happens in main.ts before any other imports
 */
useExtensionService().registerExtension({
  name: 'Comfy.Cloud.RemoteConfig',

  setup: async () => {
    const { isLoggedIn } = useCurrentUser()
    const { isActiveSubscription } = useSubscription()

    // Refresh config when subscription status changes
    // Initial auth-aware refresh happens in WorkspaceAuthGate before app renders
    watchDebounced(
      [isLoggedIn, isActiveSubscription],
      () => {
        if (!isLoggedIn.value) return
        void refreshRemoteConfig()
      },
      { debounce: 256 }
    )

    // Poll for config updates every 10 minutes (with auth)
    setInterval(() => void refreshRemoteConfig(), 600_000)
  }
})
