import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.CloudSubscription',

  setup: async () => {
    const { isLoggedIn } = useCurrentUser()
    const { requireActiveSubscription } = useSubscription()

    const checkSubscriptionStatus = () => {
      if (!isLoggedIn.value) return

      void requireActiveSubscription()
    }

    watch(() => isLoggedIn.value, checkSubscriptionStatus, {
      immediate: true
    })
  }
})
