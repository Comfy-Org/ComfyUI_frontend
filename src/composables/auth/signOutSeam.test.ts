import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  beginVoluntarySignOut,
  endVoluntarySignOut,
  isVoluntarySignOutInProgress
} from '@/platform/auth/session/sessionExpiry'

// vi.hoisted runs before `vue` is importable, so the ref is built inside the
// mock factory below and handed back here for the tests to drive.
const mocks = vi.hoisted(() => ({
  currentUser: { value: null } as { value: { uid: string } | null }
}))

vi.mock('@/stores/authStore', async () => {
  const { ref } = await import('vue')
  mocks.currentUser = ref(null)
  return {
    useAuthStore: () => ({
      get currentUser() {
        return mocks.currentUser.value
      }
    })
  }
})

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({ isAuthenticated: false, currentUser: null })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({})
}))

/**
 * Stands in for the auth SDK's sign-out, preserving the one property this seam
 * depends on: the store is cleared from deep inside the awaited call, and the
 * promise then unwinds through several async frames before the caller's
 * `finally` runs. Collapsing those frames — clearing the store in the same
 * block that releases the bracket — produces an ordering the real chain never
 * emits, and a test built on it measures nothing.
 */
async function signOutLikeTheAuthSdk(): Promise<void> {
  await (async () => {
    await Promise.resolve()
    void Promise.resolve().then(() => {
      mocks.currentUser.value = null
    })
  })()
}

async function logoutThroughTheStore(): Promise<void> {
  await (async () => await signOutLikeTheAuthSdk())()
}

beforeEach(() => {
  mocks.currentUser.value = { uid: 'uid-a' }
  endVoluntarySignOut()
})

/**
 * The design rests on one ordering: the sign-out hook must still see the
 * deliberate bracket when it runs. The bracket is released in a `finally` as
 * soon as the sign-out resolves, while the hook is reached through a Vue
 * watcher — a different scheduler. Every other test of this behaviour stubs one
 * side or the other, so none of them can see the seam.
 */
describe('deliberate sign-out, observed through the real auth watcher', () => {
  it('is still bracketed when the hook runs, so no expiry banner appears', async () => {
    let observed: boolean | undefined
    useCurrentUser().onUserLogout(() => {
      observed = isVoluntarySignOutInProgress()
    })

    beginVoluntarySignOut()
    try {
      await logoutThroughTheStore()
    } finally {
      endVoluntarySignOut()
    }
    await nextTick()

    expect(observed).toBe(true)
  })

  it('is not deliberate for a sign-out nobody bracketed, so the session suspends', async () => {
    let observed: boolean | undefined
    useCurrentUser().onUserLogout(() => {
      observed = isVoluntarySignOutInProgress()
    })

    await logoutThroughTheStore()
    await nextTick()

    expect(observed).toBe(false)
  })
})
