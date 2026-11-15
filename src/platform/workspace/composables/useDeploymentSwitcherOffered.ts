import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'

/** Whether the Run bar offers the deployment switcher. */
export function useDeploymentSwitcherOffered() {
  const { isApiKeyLogin } = useCurrentUser()
  return computed(() => isCloud && !isApiKeyLogin.value)
}
