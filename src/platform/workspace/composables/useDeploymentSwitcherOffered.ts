import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'

/** True on a Comfy Cloud sign-in that the deployment switcher serves. */
export function useDeploymentSwitcherOffered() {
  const { isApiKeyLogin } = useCurrentUser()
  return computed(() => isCloud && !isApiKeyLogin.value)
}
