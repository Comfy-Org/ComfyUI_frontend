/**
 * @fileoverview Authentication Service Worker (Development Version)
 * Intercepts /api/view requests and rewrites them to a configurable base URL with auth token.
 * Required for browser-native requests (img, video, audio) that cannot send custom headers.
 * This version is used in development to proxy requests to staging/test environments.
 * Default base URL: https://testcloud.comfy.org (configurable via SET_BASE_URL message)
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

/** @type {string} */
let baseUrl = 'https://testcloud.comfy.org'

self.addEventListener('message', (event) => {
  if (event.data.type === 'INVALIDATE_AUTH_HEADER') {
    authCache = null
    authRequestInFlight = null
  }

  if (event.data.type === 'SET_BASE_URL') {
    baseUrl = event.data.baseUrl
    console.log('[Auth DEV SW] Base URL set to:', baseUrl)
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
        // Rewrite URL to use configured base URL (default: stagingcloud.comfy.org)
        const originalUrl = new URL(event.request.url)
        const rewrittenUrl = new URL(
          originalUrl.pathname + originalUrl.search,
          baseUrl
        )

        const authHeader = await getAuthHeader()

        // With mode: 'no-cors', Authorization headers are stripped by the browser
        // So we add the token to the URL as a query parameter instead
        if (authHeader && authHeader.Authorization) {
          const token = authHeader.Authorization.replace('Bearer ', '')
          rewrittenUrl.searchParams.set('token', token)
        }

        // Cross-origin request requires no-cors mode
        // - mode: 'no-cors' allows cross-origin fetches without CORS headers
        // - Returns opaque response, which works fine for images/videos/audio
        // - Auth token is sent via query parameter since headers are stripped in no-cors mode
        // - Server may return redirect to GCS, which will be followed automatically
        return fetch(rewrittenUrl, {
          method: 'GET',
          redirect: 'follow',
          mode: 'no-cors'
        })
      } catch (error) {
        console.error('[Auth DEV SW] Request failed:', error)
        const originalUrl = new URL(event.request.url)
        const rewrittenUrl = new URL(
          originalUrl.pathname + originalUrl.search,
          baseUrl
        )
        return fetch(rewrittenUrl, {
          mode: 'no-cors',
          redirect: 'follow'
        })
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
        '[Auth DEV SW] Timeout waiting for auth header from main thread'
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
