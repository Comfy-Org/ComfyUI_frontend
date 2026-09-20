import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useCurrentUser as realUseCurrentUser } from '../useCurrentUser'

function createWatchHandle(): ReturnType<
  ReturnType<typeof realUseCurrentUser>['onUserResolved']
> {
  const stop = vi.fn()
  return Object.assign(stop, { stop, pause: vi.fn(), resume: vi.fn() })
}

const defaults: ReturnType<typeof realUseCurrentUser> = {
  loading: false,
  isLoggedIn: computed(() => false),
  isApiKeyLogin: computed(() => false),
  isEmailProvider: computed(() => false),
  userDisplayName: computed(() => undefined),
  userEmail: computed(() => undefined),
  userPhotoUrl: computed(() => undefined),
  providerName: computed(() => undefined),
  providerIcon: computed(() => 'pi pi-user'),
  resolvedUserInfo: computed(() => null),
  handleSignOut: vi.fn(async () => {}),
  handleSignIn: vi.fn(async () => {}),
  onUserResolved: vi.fn(createWatchHandle),
  onTokenRefreshed: vi.fn(createWatchHandle),
  onUserLogout: vi.fn()
}

const currentUser = { ...defaults }

export const useCurrentUser = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(currentUser, defaults)
  })
  return currentUser
})
