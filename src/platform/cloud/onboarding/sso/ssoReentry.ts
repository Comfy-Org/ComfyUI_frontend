import type { WebSessionEnd } from '@/platform/auth/session/cloudWebSessionStore'
import type { SsoHint } from '@/platform/auth/session/ssoReentryStorage'

/** `failed` is a return from ingest carrying `?sso_error=`. */
export type SsoReentryAttempt = 'none' | 'recent' | 'failed'

export type SsoReentry =
  | { readonly kind: 'sso-redirect'; readonly email: string }
  | { readonly kind: 'login-with-sso-open' }
  | { readonly kind: 'login' }

const LOGIN: SsoReentry = { kind: 'login' }
const LOGIN_WITH_SSO_OPEN: SsoReentry = { kind: 'login-with-sso-open' }

/** Where a tab goes to sign in again; undefined `sessionEnd` means no web session. */
export function decideSsoReentry(input: {
  readonly ssoEnabled: boolean
  readonly sessionEnd: WebSessionEnd | undefined
  readonly hint: SsoHint | null
  readonly attempt: SsoReentryAttempt
}): SsoReentry {
  const { ssoEnabled, sessionEnd, hint, attempt } = input
  if (!ssoEnabled || sessionEnd !== 'lapsed' || attempt === 'failed') {
    return LOGIN
  }
  if (!hint) return LOGIN
  return attempt === 'none'
    ? { kind: 'sso-redirect', email: hint.email }
    : LOGIN_WITH_SSO_OPEN
}
