import type { CrossTabRefreshPort } from './session.js'

/**
 * Web Locks + BroadcastChannel implementation of the cross-tab refresh port.
 * The coordination key names both the lock and the channel. Resolves to
 * undefined where either API is missing (older browsers, non-browser and
 * unit-test environments), so hosts fall back to uncoordinated per-tab
 * refresh.
 */
export function createWebCrossTabRefreshPort():
  | CrossTabRefreshPort
  | undefined {
  // Feature-detect defensively: test DOMs ship these piecemeal (happy-dom
  // has a BroadcastChannel but a null navigator.locks), and either gap must
  // resolve to undefined.
  if (typeof BroadcastChannel === 'undefined') return undefined
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return undefined
  }
  const locks = navigator.locks
  return {
    requestLeadership(key, onAcquired) {
      const controller = new AbortController()
      let releaseHeld: (() => void) | undefined
      void locks
        .request(key, { signal: controller.signal }, () => {
          onAcquired()
          // Hold the lock until released; the browser releases it for us
          // when the tab dies, which is what promotes the next tab.
          return new Promise<void>((resolve) => {
            releaseHeld = resolve
          })
        })
        .catch(() => undefined)
      return () => {
        controller.abort()
        releaseHeld?.()
      }
    },
    publishCredential(key, credential) {
      const channel = new BroadcastChannel(key)
      channel.postMessage(credential)
      channel.close()
    },
    onCredential(key, callback) {
      const channel = new BroadcastChannel(key)
      channel.onmessage = (event) => {
        const message: unknown = event.data
        callback(message)
      }
      return () => channel.close()
    }
  }
}
