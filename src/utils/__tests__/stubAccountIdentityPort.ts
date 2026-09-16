import { vi } from 'vitest'

import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'

/**
 * Keeps the session client's construction-time port subscription off
 * Firebase. Pair with module-scope `vi.mock(import('firebase/auth'))` in the
 * suite; hoisting keeps it there.
 */
export function stubAccountIdentityPort() {
  return vi.spyOn(firebaseIdentity, 'onUserChanged').mockReturnValue(() => {})
}
