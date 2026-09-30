/**
 * Password sign-in through ingest (`POST /api/auth/authenticate`), so the
 * browser does not call Firebase itself. Ingest checks the password with
 * Firebase and sets the web session cookie.
 */
import { z } from 'zod'

export const AUTHENTICATE_PATH = '/api/auth/authenticate'
const AUTHENTICATE_TIMEOUT_MS = 15000

// Swap for the generated schema once ingest-types carries it.
const zAuthenticateResponse = z.object({
  method: z.enum(['sso', 'password', 'session', 'firebase'])
})
const zAuthenticateRefusal = z.object({
  code: z.string(),
  start_url: z.string().optional()
})

export type PasswordSignIn =
  /** Signed in: the web session cookie is set. */
  | { readonly kind: 'session' }
  /** Right password, but this account still signs in with Firebase here. */
  | { readonly kind: 'firebase' }
  | { readonly kind: 'sso-required' }
  /** Wrong email or password; ingest never says which. */
  | { readonly kind: 'invalid-credentials' }
  | { readonly kind: 'rate-limited' }
  /** Network failure, timeout, 5xx or an unreadable answer. */
  | { readonly kind: 'unavailable' }

/** Signs in with a password through ingest. Never throws. */
export async function authenticateWithPassword(
  email: string,
  password: string,
  options: {
    readonly fetchImpl: typeof fetch
    readonly baseUrl?: string
    readonly signal?: AbortSignal
    readonly timeoutMs?: number
  }
): Promise<PasswordSignIn> {
  const timeout = AbortSignal.timeout(
    options.timeoutMs ?? AUTHENTICATE_TIMEOUT_MS
  )
  try {
    const response = await options.fetchImpl(
      `${options.baseUrl ?? ''}${AUTHENTICATE_PATH}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        signal: options.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout
      }
    )
    if (response.status === 401) return { kind: 'invalid-credentials' }
    if (response.status === 429) return { kind: 'rate-limited' }
    const body: unknown = await response.json()
    if (response.status === 403) {
      const refusal = zAuthenticateRefusal.safeParse(body)
      return refusal.success && refusal.data.code === 'sso_required'
        ? { kind: 'sso-required' }
        : { kind: 'unavailable' }
    }
    if (!response.ok) return { kind: 'unavailable' }
    const parsed = zAuthenticateResponse.safeParse(body)
    if (!parsed.success) return { kind: 'unavailable' }
    switch (parsed.data.method) {
      case 'session':
        return { kind: 'session' }
      case 'firebase':
        return { kind: 'firebase' }
      case 'sso':
        return { kind: 'sso-required' }
      case 'password':
        return { kind: 'unavailable' }
    }
  } catch {
    return { kind: 'unavailable' }
  }
}
