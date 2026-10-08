import { whenever } from '@vueuse/core'
import { onTestFinished, vi } from 'vitest'
import { computed, watch } from 'vue'
import type { WatchHandle } from 'vue'

import type { useCurrentUser as realUseCurrentUser } from '../useCurrentUser'

type CurrentUser = ReturnType<typeof realUseCurrentUser>

const resolvedUserWatchers = new Set<WatchHandle>()

function trackResolvedUserWatcher(handle: WatchHandle): WatchHandle {
  resolvedUserWatchers.add(handle)
  return handle
}

function createWatchHandle(): ReturnType<CurrentUser['onTokenRefreshed']> {
  const stop = vi.fn()
  return Object.assign(stop, { stop, pause: vi.fn(), resume: vi.fn() })
}

const defaults: CurrentUser = {
  loading: false,
  isAuthInitialized: computed(() => true),
  isLoggedIn: computed(() => false),
  isApiKeyLogin: computed(() => false),
  isEmailProvider: computed(() => false),
  needsFirebaseSignIn: computed(() => false),
  userDisplayName: computed(() => undefined),
  userEmail: computed(() => undefined),
  userPhotoUrl: computed(() => undefined),
  providerName: computed(() => undefined),
  providerIcon: computed(() => 'pi pi-user'),
  resolvedUserInfo: computed(() => null),
  handleSignOut: vi.fn(async () => {}),
  handleSignIn: vi.fn(async () => {}),
  onUserResolved: vi.fn((callback) =>
    trackResolvedUserWatcher(
      whenever(() => currentUser.resolvedUserInfo.value, callback, {
        immediate: true
      })
    )
  ),
  onTokenRefreshed: vi.fn(createWatchHandle),
  onUserLogout: vi.fn((callback) => {
    trackResolvedUserWatcher(
      watch(
        () => currentUser.resolvedUserInfo.value,
        (user, previousUser) => {
          if (previousUser && !user) callback()
        }
      )
    )
  })
}

const currentUser = { ...defaults }

export const useCurrentUser = vi.fn(() => {
  onTestFinished(() => {
    for (const stop of resolvedUserWatchers) stop()
    resolvedUserWatchers.clear()
    Object.assign(currentUser, defaults)
  })
  return currentUser
})
