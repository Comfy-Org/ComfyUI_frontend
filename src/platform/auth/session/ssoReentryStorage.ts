import { z } from 'zod'

import type { WebSession } from '@comfyorg/account-core/webSession'

const HINT_KEY = 'Comfy.WebSession.SsoHint'
const ATTEMPT_KEY = 'Comfy.WebSession.SsoReentryAt'
const ATTEMPT_WINDOW_MS = 5 * 60_000
const SSO_SIGN_IN_PROVIDERS: ReadonlySet<string> = new Set([
  'saml.workos',
  'oidc.workos'
])

const zHint = z.object({ email: z.string().min(1) })
const zAttemptAt = z.number()

/** A convenience hint, never proof of identity: the session decides that. */
export type SsoHint = z.infer<typeof zHint>

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function forgetSsoHint(): void {
  try {
    localStorage.removeItem(HINT_KEY)
  } catch {
    return
  }
}

export function isSsoSession(user: WebSession['user']): boolean {
  return SSO_SIGN_IN_PROVIDERS.has(user.signInProvider ?? '')
}

/** Keyed on the provider the server reports, so only an SSO session leaves a hint. */
export function rememberSignedInSession(user: WebSession['user']): void {
  if (!isSsoSession(user)) {
    forgetSsoHint()
    return
  }
  const hint: SsoHint = { email: user.email }
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify(hint))
  } catch {
    return
  }
}

export function readSsoHint(): SsoHint | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(HINT_KEY)
  } catch {
    return null
  }
  const hint = zHint.safeParse(parseJson(raw))
  return hint.success ? hint.data : null
}

/** Unreadable storage counts as recent, so a tab that cannot remember never loops. */
export function hasRecentSsoReentry(now = Date.now()): boolean {
  let raw: string | null
  try {
    raw = sessionStorage.getItem(ATTEMPT_KEY)
  } catch {
    return true
  }
  const at = zAttemptAt.safeParse(parseJson(raw))
  return at.success && now >= at.data && now - at.data < ATTEMPT_WINDOW_MS
}

/** False when the attempt could not be recorded; the caller must not redirect. */
export function markSsoReentry(now = Date.now()): boolean {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(now))
    return true
  } catch {
    return false
  }
}
