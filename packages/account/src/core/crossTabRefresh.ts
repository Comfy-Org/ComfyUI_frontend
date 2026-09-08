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
  // One channel per key, shared by subscribe and publish. A channel never
  // delivers a message back to itself, so publishing on the subscription
  // channel keeps a tab from hearing its own broadcasts.
  const channels = new Map<string, BroadcastChannel>()
  const channelFor = (key: string): BroadcastChannel => {
    const existing = channels.get(key)
    if (existing !== undefined) return existing
    const created = new BroadcastChannel(key)
    channels.set(key, created)
    return created
  }
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
        .catch((error: unknown) => {
          // Abandoning the request aborts it; anything else means this tab
          // silently never leads, which deserves a trace.
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
          console.warn('Cross-tab refresh leadership request failed:', error)
        })
      return () => {
        controller.abort()
        releaseHeld?.()
      }
    },
    publishCredential(key, credential) {
      channelFor(key).postMessage(credential)
    },
    onCredential(key, callback) {
      const channel = channelFor(key)
      channel.onmessage = (event) => {
        const message: unknown = event.data
        callback(message)
      }
      return () => {
        channel.close()
        channels.delete(key)
      }
    }
  }
}
