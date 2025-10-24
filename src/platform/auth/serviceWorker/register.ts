import { watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

/**
 * Registers the authentication service worker for cloud distribution.
 * Intercepts /api/view requests to add auth headers for browser-native requests.
 */
async function registerAuthServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return
  }

  try {
    await navigator.serviceWorker.register('/auth-sw.js')

    setupAuthHeaderProvider()
    setupCacheInvalidation()
  } catch (error) {
    console.error('[Auth SW] Registration failed:', error)
  }
}

/**
 * Listens for auth header requests from the service worker
 */
function setupAuthHeaderProvider(): void {
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data.type === 'REQUEST_AUTH_HEADER') {
      const firebaseAuthStore = useFirebaseAuthStore()
      const authHeader = await firebaseAuthStore.getAuthHeader()

      event.ports[0].postMessage({
        type: 'AUTH_HEADER_RESPONSE',
        authHeader
      })
    }
  })
}

/**
 * Invalidates cached auth header when user logs in/out
 */
function setupCacheInvalidation(): void {
  const { isLoggedIn } = useCurrentUser()

  watch(isLoggedIn, (newValue, oldValue) => {
    if (newValue !== oldValue) {
      navigator.serviceWorker.controller?.postMessage({
        type: 'INVALIDATE_AUTH_HEADER'
      })
    }
  })
}

void registerAuthServiceWorker()
