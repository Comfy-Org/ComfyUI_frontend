import type { User } from 'firebase/auth'
import { vi } from 'vitest'

import { useAuthStore } from '@/stores/authStore'

export type IdentityObserver = (user: User | null) => void

/**
 * Silences the session client's construction-time port subscription: the spy
 * keeps the identity's lazy auth resolver from reaching `firebase/app`; the
 * suite's `firebase/auth` automock already silences `onAuthStateChanged`.
 * Call after the suite's `firebase/auth` stubs and before the first
 * `useWorkspaceAuthStore()`.
 */
export function stubAccountIdentityPort(): void {
  vi.spyOn(useAuthStore().identity, 'onUserChanged').mockReturnValue(() => {})
}

/**
 * Fakes the auth-state registration behind the identity port: every observer
 * joins `observers` and is replayed with `currentUser()` on registration.
 * Firebase resolves persistence before its first emission, so 'microtask' is
 * the SDK's timing; 'sync' exists to prove what does not depend on it.
 */
export function replayIdentityPort(
  currentUser: () => User | null,
  deliver: 'microtask' | 'sync' = 'microtask'
) {
  const observers = new Set<IdentityObserver>()
  const register = (observer: IdentityObserver): (() => void) => {
    observers.add(observer)
    const replay = () => {
      if (observers.has(observer)) observer(currentUser())
    }
    if (deliver === 'sync') replay()
    else queueMicrotask(replay)
    return () => observers.delete(observer)
  }
  const emit = (user: User | null): void =>
    observers.forEach((observer) => observer(user))
  return { observers, register, emit }
}
