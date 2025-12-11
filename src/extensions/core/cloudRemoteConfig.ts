import { watchDebounced } from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { loadRemoteConfig } from '@/platform/remoteConfig/remoteConfig'
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

    watchDebounced(
      [isLoggedIn, isActiveSubscription],
      () => {
        if (!isLoggedIn.value) return
        void refreshRemoteConfig()
      },
      { debounce: 256, immediate: true }
    )

    // Poll for config updates every 10 minutes
    setInterval(() => void loadRemoteConfig(), 600_000)
  }
})
