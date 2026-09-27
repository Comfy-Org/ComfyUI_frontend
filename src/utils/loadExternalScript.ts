const POLL_INTERVAL_MS = 50

/**
 * Returns a singleton loader for an external script. `getReady` should return
 * the resolved value when the script's global is available, or `null` when not.
 * The returned function caches the in-flight Promise so concurrent callers share
 * one load, and resets on failure so a later caller can retry.
 */
export function createScriptLoader<T>(
  src: string,
  getReady: () => T | null,
  timeoutMs = 10_000
): () => Promise<T> {
  let scriptPromise: Promise<T> | null = null

  return function loadScript(): Promise<T> {
    if (scriptPromise) return scriptPromise

    scriptPromise = new Promise<T>((resolve, reject) => {
      let settled = false
      let cancelPoll: (() => void) | undefined

      function trySettle(fn: () => void) {
        if (settled) return
        settled = true
        fn()
      }

      const ready = getReady()
      if (ready !== null) {
        resolve(ready)
        return
      }

      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${src}"]`
      )

      function startPoll(onSuccess: () => void): () => void {
        const pollId = window.setInterval(() => {
          const value = getReady()
          if (value !== null) {
            window.clearInterval(pollId)
            onSuccess()
            trySettle(() => resolve(value))
          }
        }, POLL_INTERVAL_MS)
        return () => window.clearInterval(pollId)
      }

      if (existing) {
        // load/error may have already fired on the pre-existing tag; poll for readiness
        const timeoutId = window.setTimeout(() => {
          cancelPoll?.()
          trySettle(() => {
            scriptPromise = null
            reject(new Error(`Script load timed out: ${src}`))
          })
        }, timeoutMs)
        cancelPoll = startPoll(() => window.clearTimeout(timeoutId))
        return
      }

      const scriptEl = document.createElement('script')

      const timeoutId = window.setTimeout(() => {
        cancelPoll?.()
        scriptEl.remove()
        trySettle(() => {
          scriptPromise = null
          reject(new Error(`Script load timed out: ${src}`))
        })
      }, timeoutMs)

      scriptEl.addEventListener(
        'load',
        () => {
          if (settled) return
          const value = getReady()
          if (value !== null) {
            window.clearTimeout(timeoutId)
            trySettle(() => resolve(value))
          } else {
            // global may arrive asynchronously after load; poll under the shared timeout
            cancelPoll = startPoll(() => window.clearTimeout(timeoutId))
          }
        },
        { once: true }
      )
      scriptEl.addEventListener(
        'error',
        () => {
          window.clearTimeout(timeoutId)
          scriptEl.remove()
          trySettle(() => {
            scriptPromise = null
            reject(new Error(`Script failed to load: ${src}`))
          })
        },
        { once: true }
      )

      scriptEl.src = src
      scriptEl.async = true
      document.head.appendChild(scriptEl)
    })

    return scriptPromise
  }
}
