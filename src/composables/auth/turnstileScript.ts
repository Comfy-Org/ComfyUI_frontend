const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_LOAD_TIMEOUT_MS = 10_000
const SCRIPT_POLL_INTERVAL_MS = 50

interface TurnstileRenderOptions {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

interface TurnstileApi {
  render: (
    container: string | HTMLElement,
    options: TurnstileRenderOptions
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/**
 * Module-level singleton so every consumer shares one script load.
 * Resets to `null` on failure so a later consumer can retry.
 */
let scriptPromise: Promise<TurnstileApi> | null = null

export function loadTurnstile(): Promise<TurnstileApi> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SRC}"]`
    )

    // A matching <script> is already in the DOM (an externally-injected tag, or
    // one left over from a prior load). Its `load`/`error` events may have
    // ALREADY fired, so attaching fresh listeners would never run and the
    // promise could only settle via the timeout. Poll for the global instead so
    // an already-loaded tag resolves promptly.
    if (existing) {
      const timeoutId = window.setTimeout(() => {
        window.clearInterval(pollId)
        scriptPromise = null
        reject(new Error('Turnstile script load timed out'))
      }, SCRIPT_LOAD_TIMEOUT_MS)

      const pollId = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(pollId)
          window.clearTimeout(timeoutId)
          resolve(window.turnstile)
        }
      }, SCRIPT_POLL_INTERVAL_MS)
      return
    }

    const scriptEl = document.createElement('script')

    const timeoutId = window.setTimeout(() => {
      scriptEl.remove()
      scriptPromise = null
      reject(new Error('Turnstile script load timed out'))
    }, SCRIPT_LOAD_TIMEOUT_MS)

    scriptEl.addEventListener(
      'load',
      () => {
        window.clearTimeout(timeoutId)
        if (window.turnstile) {
          resolve(window.turnstile)
        } else {
          // Remove the dead tag so a later retry starts clean instead of
          // finding a script whose events have already fired.
          scriptEl.remove()
          scriptPromise = null
          reject(new Error('Turnstile script loaded without global'))
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
        reject(new Error('Turnstile script failed to load'))
      },
      { once: true }
    )

    scriptEl.src = TURNSTILE_SRC
    scriptEl.async = true
    document.head.appendChild(scriptEl)
  })

  return scriptPromise
}
