/**
 * Enterprise SSO sign-in on ingest: the email-first discover call, the start
 * URL the browser navigates to, and the codes a failed sign-in comes back with.
 * Hosts own the copy; this module ships no strings a person reads.
 */
import { zErrorResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { safeInternalPath } from './redirect.js'

export const SSO_DISCOVER_PATH = '/api/auth/sso/discover'
export const SSO_START_PATH = '/api/auth/sso/start'
export const SSO_EMAIL_MAX_LENGTH = 320
const DISCOVER_TIMEOUT_MS = 5000

// Swap for the generated zSSODiscoverResponse once ingest-types carries it.
const zSsoDiscoverResponse = z.object({
  sso: z.boolean(),
  organization_name: z.string().optional()
})

export type SsoDiscovery =
  | { readonly kind: 'sso'; readonly organizationName?: string }
  | { readonly kind: 'not-sso' }
  | { readonly kind: 'invalid-email' }
  | { readonly kind: 'unavailable' }

/**
 * Whether an email signs in through its organization's SSO. Never throws: a
 * network failure, timeout, 5xx or unreadable body is `unavailable`, so the
 * caller can fall through to its usual sign-in.
 */
export async function discoverSso(
  email: string,
  options: {
    readonly fetchImpl: typeof fetch
    readonly baseUrl?: string
    readonly signal?: AbortSignal
    readonly timeoutMs?: number
  }
): Promise<SsoDiscovery> {
  const trimmed = email.trim()
  if (!trimmed || trimmed.length > SSO_EMAIL_MAX_LENGTH) {
    return { kind: 'invalid-email' }
  }
  const { fetchImpl } = options
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DISCOVER_TIMEOUT_MS)
  try {
    const response = await fetchImpl(
      `${options.baseUrl ?? ''}${SSO_DISCOVER_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
        signal: options.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout
      }
    )
    const body: unknown = await response.json()
    if (response.status === 400) {
      const error = zErrorResponse.safeParse(body)
      return error.success && error.data.code === 'INVALID_EMAIL'
        ? { kind: 'invalid-email' }
        : { kind: 'unavailable' }
    }
    if (!response.ok) return { kind: 'unavailable' }
    const parsed = zSsoDiscoverResponse.safeParse(body)
    if (!parsed.success) return { kind: 'unavailable' }
    if (!parsed.data.sso) return { kind: 'not-sso' }
    return parsed.data.organization_name
      ? { kind: 'sso', organizationName: parsed.data.organization_name }
      : { kind: 'sso' }
  } catch {
    return { kind: 'unavailable' }
  }
}

/** Ingest refuses `/api` paths as `return_to`, so they fall back here too. */
export function safeSsoReturnTo(
  raw: string | null | undefined,
  origin: string,
  fallback: string
): string {
  const path = safeInternalPath(raw, origin, fallback)
  const pathname = new URL(path, origin).pathname.toLowerCase()
  return pathname === '/api' || pathname.startsWith('/api/') ? fallback : path
}

/** The start URL for `window.location.assign`; it must never be fetched. */
export function ssoStartUrl(options: {
  readonly email: string
  readonly returnTo: string | null | undefined
  readonly origin: string
  readonly fallbackReturnTo?: string
}): string {
  const url = new URL(SSO_START_PATH, options.origin)
  url.searchParams.set('email', options.email.trim())
  url.searchParams.set(
    'return_to',
    safeSsoReturnTo(
      options.returnTo,
      options.origin,
      options.fallbackReturnTo ?? '/'
    )
  )
  return url.toString()
}

/** Every code ingest's SSO start and callback send back as `?sso_error=`. */
export const SSO_ERROR_CODES = [
  'SSO_UNAVAILABLE',
  'SSO_CONFIRM_EXPIRED',
  'SSO_INVALID_STATE',
  'SSO_NOT_CONFIGURED',
  'SSO_ORG_DISABLED',
  'SSO_ORG_NOT_ATTACHED',
  'SSO_ORG_MISMATCH',
  'SSO_NOT_PROVISIONED',
  'SSO_USER_SUSPENDED',
  'SSO_ACCOUNT_DELETED',
  'SSO_ACCOUNT_CONFLICT',
  'SSO_LINK_CHECK_FAILED',
  'SSO_IDP_ERROR',
  'SSO_EXCHANGE_FAILED',
  'SSO_SIGN_IN_FAILED',
  'SESSION_CREATION_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR'
] as const

export type SsoErrorCode = (typeof SSO_ERROR_CODES)[number]

const KNOWN_SSO_ERRORS: ReadonlySet<string> = new Set(SSO_ERROR_CODES)

function isSsoErrorCode(value: string): value is SsoErrorCode {
  return KNOWN_SSO_ERRORS.has(value)
}

/** Reads `?sso_error=`: null when absent, `unknown` for a code this build predates. */
export function readSsoError(raw: unknown): SsoErrorCode | 'unknown' | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || !value) return null
  return isSsoErrorCode(value) ? value : 'unknown'
}

/**
 * A 403 body refusing a non-SSO credential: ingest answers
 * `{ code: 'sso_required' }`, comfy-api a message prefixed `sso_required:`.
 */
export function isSsoRequiredRefusal(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  if ('code' in body && body.code === 'sso_required') return true
  return (
    'message' in body &&
    typeof body.message === 'string' &&
    body.message.startsWith('sso_required')
  )
}

/** A sign-in the account's SSO organization refused outside its own SSO. */
export class SsoRequiredError extends Error {
  readonly email: string | undefined

  constructor(email?: string) {
    super('sso_required')
    this.name = 'SsoRequiredError'
    this.email = email
  }
}
