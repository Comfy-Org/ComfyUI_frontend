import { z } from 'zod'

import type { WebSession } from '@comfyorg/account-core/webSession'

import {
  safeLocalStorage,
  safeSessionStorage
} from '@comfyorg/shared-frontend-utils/safeStorage'

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
  safeLocalStorage.removeItem(HINT_KEY)
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
  safeLocalStorage.setItem(HINT_KEY, JSON.stringify(hint))
}

export function readSsoHint(): SsoHint | null {
  const raw = safeLocalStorage.getItem(HINT_KEY)
  const hint = zHint.safeParse(parseJson(raw))
  return hint.success ? hint.data : null
}

/** Unreadable storage counts as recent, so a tab that cannot remember never loops. */
export function hasRecentSsoReentry(now = Date.now()): boolean {
  if (!safeSessionStorage.isPersistent) return true
  const attempt = safeSessionStorage.read(ATTEMPT_KEY)
  if (!attempt.ok) return true
  const at = zAttemptAt.safeParse(parseJson(attempt.value))
  return at.success && now >= at.data && now - at.data < ATTEMPT_WINDOW_MS
}

/** False when the attempt could not be recorded; the caller must not redirect. */
export function markSsoReentry(now = Date.now()): boolean {
  return (
    safeSessionStorage.isPersistent &&
    safeSessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(now)) === 'ok'
  )
}
