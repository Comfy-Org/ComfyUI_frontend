/**
 * Authorization code + PKCE (RFC 7636, S256 only) against the Cloud OAuth
 * server, for a browser page that signs in as a public client. Builds the
 * authorize URL, reads the redirect back, and runs the code and refresh grants
 * on `/oauth/token`. Holds no state: the caller keeps the verifier and state
 * across the redirect and owns where the tokens live.
 */
import type { OAuthTokenResponse } from '@comfyorg/ingest-types'
import {
  zOAuthTokenError,
  zOAuthTokenResponse
} from '@comfyorg/ingest-types/zod'

import { timedSignal } from './core/requestTimeout.js'

export const LOCAL_WEB_CLIENT_ID = 'comfy-local-web'

const AUTHORIZE_PATH = '/oauth/authorize'
const TOKEN_PATH = '/oauth/token'
/** The `comfy-cloud` resource is seeded issuer-relative at `/api`. */
const CLOUD_RESOURCE_PATH = '/api'
const DEFAULT_TOKEN_TIMEOUT_MS = 15_000
/** 32 bytes encode to the 43-character minimum verifier length. */
const RANDOM_BYTES = 32

function base64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(RANDOM_BYTES)))
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )
  return base64Url(new Uint8Array(digest))
}

export interface PkceRequest {
  readonly verifier: string
  readonly challenge: string
  readonly state: string
}

/** A fresh verifier, its S256 challenge, and an unguessable `state`. */
export async function createPkceRequest(): Promise<PkceRequest> {
  const verifier = randomToken()
  return {
    verifier,
    challenge: await codeChallengeS256(verifier),
    state: randomToken()
  }
}

/** The redirect URI registered for a page served at `origin`. */
export function localRedirectUri(origin: string): string {
  return new URL('/', origin).href
}

export interface AuthorizeUrlOptions {
  /** Cloud origin, e.g. `https://cloud.comfy.org`. */
  readonly issuer: string
  readonly clientId: string
  readonly redirectUri: string
  readonly challenge: string
  readonly state: string
}

/** Where the browser navigates to sign in; never fetched. */
export function authorizeUrl(options: AuthorizeUrlOptions): string {
  const url = new URL(AUTHORIZE_PATH, options.issuer)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
    state: options.state,
    resource: new URL(CLOUD_RESOURCE_PATH, options.issuer).href
  }).toString()
  return url.href
}

export type AuthorizationResponse =
  | { readonly kind: 'none' }
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'denied'; readonly error: string }
  | { readonly kind: 'state-mismatch' }

/**
 * Reads the authorize redirect (RFC 6749 §4.1.2) off the page URL. A response
 * whose `state` is not the one this browser sent is never used.
 */
export function readAuthorizationResponse(
  params: URLSearchParams,
  expectedState: string | undefined
): AuthorizationResponse {
  const code = params.get('code')
  const error = params.get('error')
  if (code === null && error === null) return { kind: 'none' }
  const state = params.get('state')
  if (expectedState === undefined || state !== expectedState) {
    return { kind: 'state-mismatch' }
  }
  if (error !== null) return { kind: 'denied', error }
  return code
    ? { kind: 'code', code }
    : { kind: 'denied', error: 'invalid_request' }
}

export interface OAuthTokens {
  readonly accessToken: string
  readonly refreshToken: string
  /** Epoch milliseconds. */
  readonly expiresAt: number
  readonly scope: string
}

/**
 * `invalid_grant`: the code or refresh token is dead; sign in again.
 * `rejected`: any other OAuth error the server returned.
 * `unavailable`: network failure, timeout, or a response that is not OAuth.
 */
export type TokenFailureReason = 'invalid_grant' | 'rejected' | 'unavailable'

export type TokenResult =
  | { readonly ok: true; readonly tokens: OAuthTokens }
  | {
      readonly ok: false
      readonly reason: TokenFailureReason
      readonly error?: string
    }

export interface TokenRequestOptions {
  readonly issuer: string
  readonly clientId: string
  readonly fetchImpl: typeof fetch
  readonly now: () => number
  readonly signal?: AbortSignal
  /** Default 15s. */
  readonly timeoutMs?: number
}

function toTokens(body: OAuthTokenResponse, now: number): OAuthTokens {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now + body.expires_in * 1000,
    scope: body.scope
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function classify(status: number, body: unknown, now: number): TokenResult {
  if (status === 200) {
    const parsed = zOAuthTokenResponse.safeParse(body)
    return parsed.success
      ? { ok: true, tokens: toTokens(parsed.data, now) }
      : { ok: false, reason: 'unavailable' }
  }
  const error = zOAuthTokenError.safeParse(body)
  if (status < 400 || status >= 500 || !error.success) {
    return { ok: false, reason: 'unavailable' }
  }
  return {
    ok: false,
    reason: error.data.error === 'invalid_grant' ? 'invalid_grant' : 'rejected',
    error: error.data.error
  }
}

async function postTokenGrant(
  form: Record<string, string>,
  options: TokenRequestOptions
): Promise<TokenResult> {
  const { signal, release } = timedSignal(
    options.signal,
    options.timeoutMs ?? DEFAULT_TOKEN_TIMEOUT_MS
  )
  try {
    const response = await options.fetchImpl(
      new URL(TOKEN_PATH, options.issuer).href,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...form, client_id: options.clientId }),
        signal
      }
    )
    return classify(response.status, await readJson(response), options.now())
  } catch {
    return { ok: false, reason: 'unavailable' }
  } finally {
    release()
  }
}

/** Trades the authorize redirect's code for tokens. Never throws. */
export function exchangeAuthorizationCode(
  grant: {
    readonly code: string
    readonly verifier: string
    readonly redirectUri: string
  },
  options: TokenRequestOptions
): Promise<TokenResult> {
  return postTokenGrant(
    {
      grant_type: 'authorization_code',
      code: grant.code,
      code_verifier: grant.verifier,
      redirect_uri: grant.redirectUri
    },
    options
  )
}

/**
 * Trades a refresh token for a new pair. The server rotates on every success
 * and revokes the family when an old one is replayed, so the caller must keep
 * only the returned refresh token. Never throws.
 */
export function refreshAccessToken(
  refreshToken: string,
  options: TokenRequestOptions
): Promise<TokenResult> {
  return postTokenGrant(
    { grant_type: 'refresh_token', refresh_token: refreshToken },
    options
  )
}
