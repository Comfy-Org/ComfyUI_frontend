/**
 * Enterprise SSO sign-in through ingest: the discover call that tells whether
 * an email signs in through its organization, the start URL the browser
 * navigates to, and the codes a failed sign-in comes back with. Hosts own the
 * copy; nothing here is text a person reads.
 */
import type { SsoDiscoverResponse } from '@comfyorg/ingest-types'
import {
  zDiscoverSsoBody,
  zDiscoverSsoResponse,
  zErrorResponse
} from '@comfyorg/ingest-types/zod'

import { timedSignal } from './core/requestTimeout.js'
import { safeInternalPath } from './redirect.js'

export {
  isSsoRequiredRefusal,
  ssoRequiredOrganizationId
} from './core/ssoRequired.js'

const SSO_DISCOVER_PATH = '/api/auth/sso/discover'
const SSO_START_PATH = '/api/auth/sso/start'
const DEFAULT_DISCOVER_TIMEOUT_MS = 5000

export type SsoDiscovery =
  | { readonly kind: 'sso'; readonly organizationName?: string }
  | { readonly kind: 'not-sso' }
  | { readonly kind: 'invalid-email' }
  | { readonly kind: 'unavailable' }

export interface DiscoverSsoOptions {
  readonly fetchImpl: typeof fetch
  readonly signal?: AbortSignal
  /** Ingest origin; empty (the default) means same-origin. */
  readonly baseUrl?: string
  /** A sign-in waits on this call, so it is bounded. Default 5s. */
  readonly timeoutMs?: number
}

function fromResponse(body: SsoDiscoverResponse): SsoDiscovery {
  if (!body.sso) return { kind: 'not-sso' }
  return body.organization_name === undefined
    ? { kind: 'sso' }
    : { kind: 'sso', organizationName: body.organization_name }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function classify(status: number, body: unknown): SsoDiscovery {
  if (status === 200) {
    const parsed = zDiscoverSsoResponse.safeParse(body)
    return parsed.success ? fromResponse(parsed.data) : { kind: 'unavailable' }
  }
  const error = zErrorResponse.safeParse(body)
  return status === 400 && error.success && error.data.code === 'INVALID_EMAIL'
    ? { kind: 'invalid-email' }
    : { kind: 'unavailable' }
}

/**
 * Whether an email signs in through its organization's SSO. Never throws: a
 * network failure, timeout, unexpected status or unreadable body is
 * `unavailable`, so a caller can fall back to its usual sign-in.
 */
export async function discoverSso(
  email: string,
  options: DiscoverSsoOptions
): Promise<SsoDiscovery> {
  const request = zDiscoverSsoBody.safeParse({ email: email.trim() })
  if (!request.success || request.data.email === '') {
    return { kind: 'invalid-email' }
  }
  const { signal, release } = timedSignal(
    options.signal,
    options.timeoutMs ?? DEFAULT_DISCOVER_TIMEOUT_MS
  )
  try {
    const response = await options.fetchImpl(
      `${options.baseUrl ?? ''}${SSO_DISCOVER_PATH}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.data),
        signal
      }
    )
    return classify(response.status, await readJson(response))
  } catch {
    return { kind: 'unavailable' }
  } finally {
    release()
  }
}

/**
 * Ingest sends API routes back to `/`: they refuse a cross-site navigation,
 * so the person would land on an error. Anything off-origin goes there too.
 */
function ssoReturnTo(raw: string, origin: string): string {
  const path = safeInternalPath(raw, origin, '/')
  const pathname = new URL(path, origin).pathname.toLowerCase()
  return pathname === '/api' || pathname.startsWith('/api/') ? '/' : path
}

/** A named organization is the target; otherwise the email's domain is. */
type SsoStartTarget =
  | { readonly email: string; readonly organizationId?: string }
  | { readonly email?: string; readonly organizationId: string }

/**
 * Where the browser goes to sign in with SSO. Ingest answers with a redirect
 * to the identity provider, so this is for a full-page navigation, never a
 * fetch.
 */
export function ssoStartUrl(
  options: SsoStartTarget & {
    readonly returnTo: string
    readonly origin: string
  }
): string {
  const url = new URL(SSO_START_PATH, options.origin)
  if (options.email !== undefined) {
    url.searchParams.set('email', options.email.trim())
  }
  if (options.organizationId !== undefined) {
    url.searchParams.set('organization_id', options.organizationId)
  }
  url.searchParams.set(
    'return_to',
    ssoReturnTo(options.returnTo, options.origin)
  )
  return url.toString()
}

/** Every code ingest's SSO start and callback send back as `?sso_error=`. */
const SSO_ERROR_CODES = [
  'INTERNAL_ERROR',
  'RATE_LIMITED',
  'SESSION_CREATION_FAILED',
  'SSO_ACCOUNT_CONFLICT',
  'SSO_ACCOUNT_DELETED',
  'SSO_CONFIRM_EXPIRED',
  'SSO_EXCHANGE_FAILED',
  'SSO_IDP_ERROR',
  'SSO_INVALID_STATE',
  'SSO_LINK_CHECK_FAILED',
  'SSO_NOT_CONFIGURED',
  'SSO_ORG_DISABLED',
  'SSO_ORG_MISMATCH',
  'SSO_ORG_NOT_ATTACHED',
  'SSO_SIGN_IN_FAILED',
  'SSO_UNAVAILABLE',
  'SSO_USER_SUSPENDED'
] as const

export type SsoErrorCode = (typeof SSO_ERROR_CODES)[number]

const KNOWN_SSO_ERRORS: ReadonlySet<string> = new Set(SSO_ERROR_CODES)

function isSsoErrorCode(value: string): value is SsoErrorCode {
  return KNOWN_SSO_ERRORS.has(value)
}

/**
 * Reads an `?sso_error=` query value. Absent is undefined; a code this build
 * predates reads as a generic sign-in failure, so it still gets a message.
 */
export function readSsoError(value: unknown): SsoErrorCode | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || raw === '') return undefined
  return isSsoErrorCode(raw) ? raw : 'SSO_SIGN_IN_FAILED'
}
