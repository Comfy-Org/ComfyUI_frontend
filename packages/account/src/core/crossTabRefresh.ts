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
  // One refcounted channel per subscribed key, shared by subscribe and
  // publish. A channel never delivers a message back to itself, so
  // publishing on the subscription channel keeps a tab from hearing its own
  // broadcasts.
  const channels = new Map<
    string,
    { channel: BroadcastChannel; subscribers: number }
  >()
  return {
    requestLeadership(key, onAcquired) {
      const controller = new AbortController()
      let disposed = false
      let releaseHeld: (() => void) | undefined
      void locks
        .request(key, { signal: controller.signal }, () => {
          // A grant can win the race against our own abandon; returning
          // without holding releases the lock straight to the next tab.
          if (disposed) return
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
        disposed = true
        controller.abort()
        releaseHeld?.()
      }
    },
    publishCredential(key, credential) {
      const entry = channels.get(key)
      if (entry !== undefined) {
        entry.channel.postMessage(credential)
        return
      }
      // No subscriber on this key here: publish on an ephemeral channel so
      // nothing is left open with no owner to close it.
      const channel = new BroadcastChannel(key)
      channel.postMessage(credential)
      channel.close()
    },
    onCredential(key, callback) {
      let entry = channels.get(key)
      if (entry === undefined) {
        entry = { channel: new BroadcastChannel(key), subscribers: 0 }
        channels.set(key, entry)
      }
      entry.subscribers += 1
      const subscribed = entry
      const handler = (event: MessageEvent) => {
        const message: unknown = event.data
        callback(message)
      }
      subscribed.channel.addEventListener('message', handler)
      let active = true
      return () => {
        if (!active) return
        active = false
        subscribed.channel.removeEventListener('message', handler)
        subscribed.subscribers -= 1
        if (subscribed.subscribers === 0) {
          subscribed.channel.close()
          if (channels.get(key) === subscribed) channels.delete(key)
        }
      }
    }
  }
}
