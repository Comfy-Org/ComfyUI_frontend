import { fromPartial } from '@total-typescript/shoehorn'
import type { Auth } from 'firebase/auth'
import {
  initializeAuth,
  onAuthStateChanged,
  onIdTokenChanged
} from 'firebase/auth'
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

/**
 * Lets the real `authStore` construct under a mocked `firebase/auth`: the
 * identity resolves a bare `Auth` double and neither listener ever fires.
 */
export function stubFirebaseAuthHarness() {
  vi.mocked(initializeAuth).mockReturnValue(fromPartial<Auth>({}))
  vi.mocked(onAuthStateChanged).mockReturnValue(() => {})
  vi.mocked(onIdTokenChanged).mockReturnValue(() => {})
}
