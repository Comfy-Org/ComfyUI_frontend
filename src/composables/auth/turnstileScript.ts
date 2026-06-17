const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_LOAD_TIMEOUT_MS = 10_000

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
    const scriptEl = existing ?? document.createElement('script')

    const timeoutId = window.setTimeout(() => {
      if (!existing) scriptEl.remove()
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
        if (!existing) scriptEl.remove()
        scriptPromise = null
        reject(new Error('Turnstile script failed to load'))
      },
      { once: true }
    )

    if (!existing) {
      scriptEl.src = TURNSTILE_SRC
      scriptEl.async = true
      document.head.appendChild(scriptEl)
    }
  })

  return scriptPromise
}
