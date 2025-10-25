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
    // Use dev service worker in development mode (rewrites to configured backend URL with token in query param)
    // Use production service worker in production (same-origin requests with Authorization header)
    const swPath = import.meta.env.DEV ? '/auth-dev-sw.js' : '/auth-sw.js'
    const registration = await navigator.serviceWorker.register(swPath)

    // Configure base URL for dev service worker
    if (import.meta.env.DEV) {
      console.warn('[Auth DEV SW] Registering development serviceworker')
      // Use the same URL that Vite proxy is using
      const baseUrl = __DEV_SERVER_COMFYUI_URL__
      navigator.serviceWorker.controller?.postMessage({
        type: 'SET_BASE_URL',
        baseUrl
      })

      // Also set base URL when service worker becomes active
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            navigator.serviceWorker.controller?.postMessage({
              type: 'SET_BASE_URL',
              baseUrl
            })
          }
        })
      })
    }

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

await registerAuthServiceWorker()
