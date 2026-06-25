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
      const ready = getReady()
      if (ready !== null) {
        resolve(ready)
        return
      }

      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${src}"]`
      )

      if (existing) {
        // load/error may have already fired on the pre-existing tag; poll for readiness
        const timeoutId = window.setTimeout(() => {
          window.clearInterval(pollId)
          scriptPromise = null
          reject(new Error(`Script load timed out: ${src}`))
        }, timeoutMs)
        const pollId = window.setInterval(() => {
          const value = getReady()
          if (value !== null) {
            window.clearInterval(pollId)
            window.clearTimeout(timeoutId)
            resolve(value)
          }
        }, POLL_INTERVAL_MS)
        return
      }

      const scriptEl = document.createElement('script')

      const timeoutId = window.setTimeout(() => {
        scriptEl.remove()
        scriptPromise = null
        reject(new Error(`Script load timed out: ${src}`))
      }, timeoutMs)

      scriptEl.addEventListener(
        'load',
        () => {
          window.clearTimeout(timeoutId)
          const value = getReady()
          if (value !== null) {
            resolve(value)
          } else {
            scriptEl.remove()
            scriptPromise = null
            reject(new Error(`Script loaded without global: ${src}`))
          }
        },
        { once: true }
      )
      scriptEl.addEventListener(
        'error',
        () => {
          window.clearTimeout(timeoutId)
          scriptEl.remove()
          scriptPromise = null
          reject(new Error(`Script failed to load: ${src}`))
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
