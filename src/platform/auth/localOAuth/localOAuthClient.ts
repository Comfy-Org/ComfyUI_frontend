import type {
  OAuthTokenError,
  OAuthTokenResponse
} from '@comfyorg/ingest-types'

import { LOCAL_OAUTH_CLIENT_ID } from './pkce'

const TOKEN_REQUEST_TIMEOUT_MS = 10_000

export interface LocalOAuthSession {
  accessToken: string
  refreshToken: string
  /** Epoch milliseconds. */
  expiresAt: number
  cloudBaseUrl: string
  userId: string
  email?: string
}

export class LocalOAuthTokenError extends Error {
  constructor(
    readonly code: string,
    description?: string
  ) {
    super(description ?? code)
    this.name = 'LocalOAuthTokenError'
  }

  /** The grant is dead (revoked, rotated, expired): the session must end. */
  get isGrantInvalid(): boolean {
    return this.code === 'invalid_grant'
  }
}

function decodeClaims(jwt: string): { sub?: unknown; email?: unknown } {
  const payload = jwt.split('.')[1]
  if (!payload) return {}
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims: unknown = JSON.parse(json)
    return typeof claims === 'object' && claims !== null ? claims : {}
  } catch {
    return {}
  }
}

function toSession(
  body: OAuthTokenResponse,
  cloudBaseUrl: string,
  now: number
): LocalOAuthSession {
  // Claims are read for display and identity keys only; comfy-api verifies.
  const { sub, email } = decodeClaims(body.access_token)
  if (typeof sub !== 'string' || !sub) {
    throw new LocalOAuthTokenError('invalid_token', 'token has no subject')
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now + body.expires_in * 1000,
    cloudBaseUrl,
    userId: sub,
    email: typeof email === 'string' ? email : undefined
  }
}

async function postToken(
  cloudBaseUrl: string,
  params: Record<string, string>
): Promise<LocalOAuthSession> {
  const res = await fetch(`${cloudBaseUrl}/oauth/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: LOCAL_OAUTH_CLIENT_ID, ...params }),
    signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS)
  })
  if (!res.ok) {
    const error: Partial<OAuthTokenError> = await res.json().catch(() => ({}))
    throw new LocalOAuthTokenError(
      error.error ?? `http_${res.status}`,
      error.error_description
    )
  }
  const body: OAuthTokenResponse = await res.json()
  return toSession(body, cloudBaseUrl, Date.now())
}

export function exchangeAuthorizationCode(
  cloudBaseUrl: string,
  args: { code: string; verifier: string; redirectUri: string }
): Promise<LocalOAuthSession> {
  return postToken(cloudBaseUrl, {
    grant_type: 'authorization_code',
    code: args.code,
    code_verifier: args.verifier,
    redirect_uri: args.redirectUri
  })
}

export function refreshSession(
  session: LocalOAuthSession
): Promise<LocalOAuthSession> {
  return postToken(session.cloudBaseUrl, {
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken
  })
}
