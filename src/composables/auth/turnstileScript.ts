import { createScriptLoader } from '@/utils/loadExternalScript'

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export interface TurnstileRenderOptions {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

export interface TurnstileApi {
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

const loadTurnstileScript = createScriptLoader(
  TURNSTILE_SRC,
  () => window.turnstile ?? null
)

export function loadTurnstile(): Promise<TurnstileApi> {
  return loadTurnstileScript()
}
