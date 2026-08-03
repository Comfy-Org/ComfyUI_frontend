import { computed } from 'vue'

import { getUserCapabilities } from '../userCapabilities'
import type { UserCapabilities } from '../userCapabilities'
import { useUserState } from './useUserState'

/**
 * Capabilities of the current user, derived from `UserState`. Call sites
 * should read off this instead of re-deriving `isCloud` / subscription tier
 * / feature flag combinations themselves.
 */
export function useUserCapabilities() {
  const { userState } = useUserState()

  const capabilities = computed<UserCapabilities>(() =>
    getUserCapabilities(userState.value)
  )

  return { capabilities }
}
