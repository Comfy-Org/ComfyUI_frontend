import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.CloudSubscription',

  setup: isCloud
    ? async () => {
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
    : undefined
})
