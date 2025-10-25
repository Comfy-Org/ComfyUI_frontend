/**
 * @fileoverview Authentication Service Worker
 * Intercepts /api/view requests and adds Firebase authentication headers.
 * Required for browser-native requests (img, video, audio) that cannot send custom headers.
 */

/**
 * @typedef {Object} AuthHeader
 * @property {string} Authorization - Bearer token for authentication
 */

/**
 * @typedef {Object} CachedAuth
 * @property {AuthHeader|null} header
 * @property {number} expiresAt - Timestamp when cache expires
 */

const CACHE_TTL_MS = 50 * 60 * 1000 // 50 minutes (Firebase tokens expire in 1 hour)

/** @type {CachedAuth|null} */
let authCache = null

/** @type {Promise<AuthHeader|null>|null} */
let authRequestInFlight = null

self.addEventListener('message', (event) => {
  if (event.data.type === 'INVALIDATE_AUTH_HEADER') {
    authCache = null
    authRequestInFlight = null
  }
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (
    !url.pathname.startsWith('/api/view') &&
    !url.pathname.startsWith('/api/viewvideo')
  ) {
    return
  }

  event.respondWith(
    (async () => {
      try {
        const authHeader = await getAuthHeader()

        if (!authHeader) {
          return fetch(event.request)
        }

        const headers = new Headers(event.request.headers)
        for (const [key, value] of Object.entries(authHeader)) {
          headers.set(key, value)
        }

        // Fetch with manual redirect to handle cross-origin redirects (e.g., GCS signed URLs)
        const response = await fetch(
          new Request(event.request.url, {
            method: event.request.method,
            headers: headers,
            credentials: event.request.credentials,
            cache: 'no-store',
            redirect: 'manual',
            referrer: event.request.referrer,
            integrity: event.request.integrity
          })
        )

        // If redirected to external storage (GCS), follow without auth headers
        // The signed URL contains its own authentication in query params
        if (
          response.type === 'opaqueredirect' ||
          response.status === 302 ||
          response.status === 301
        ) {
          const location = response.headers.get('location')
          if (location) {
            return fetch(location, {
              method: 'GET',
              redirect: 'follow'
            })
          }
        }

        return response
      } catch (error) {
        console.error('[Auth SW] Request failed:', error)
        return fetch(event.request)
      }
    })()
  )
})

/**
 * Gets auth header from cache or requests from main thread
 * @returns {Promise<AuthHeader|null>}
 */
async function getAuthHeader() {
  // Return cached value if valid
  if (authCache && authCache.expiresAt > Date.now()) {
    return authCache.header
  }

  // Clear expired cache
  if (authCache) {
    authCache = null
  }

  // Deduplicate concurrent requests
  if (authRequestInFlight) {
    return authRequestInFlight
  }

  authRequestInFlight = requestAuthHeaderFromMainThread()
  const header = await authRequestInFlight
  authRequestInFlight = null

  // Cache the result
  if (header) {
    authCache = {
      header,
      expiresAt: Date.now() + CACHE_TTL_MS
    }
  }

  return header
}

/**
 * Requests auth header from main thread via MessageChannel
 * @returns {Promise<AuthHeader|null>}
 */
async function requestAuthHeaderFromMainThread() {
  const clients = await self.clients.matchAll()
  if (clients.length === 0) {
    return null
  }

  const messageChannel = new MessageChannel()

  return new Promise((resolve) => {
    let timeoutId

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeoutId)
      resolve(event.data.authHeader)
    }

    timeoutId = setTimeout(() => {
      console.error(
        '[Auth SW] Timeout waiting for auth header from main thread'
      )
      resolve(null)
    }, 1000)

    clients[0].postMessage({ type: 'REQUEST_AUTH_HEADER' }, [
      messageChannel.port2
    ])
  })
}

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
