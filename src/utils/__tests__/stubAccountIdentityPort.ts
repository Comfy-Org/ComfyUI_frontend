import { vi } from 'vitest'

import { useAuthStore } from '@/stores/authStore'

/**
 * Keeps the session client's construction-time port subscription off
 * Firebase. Pair with module-scope `vi.mock(import('vuefire'))` and
 * `vi.mock(import('firebase/auth'))` in the suite; hoisting keeps those there.
 */
export function stubAccountIdentityPort() {
  return vi
    .spyOn(useAuthStore().identity, 'onUserChanged')
    .mockReturnValue(() => {})
}
