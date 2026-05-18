// All OAuth calls are relative-URL (same-origin) on purpose. useSessionCookie
// POSTs /api/auth/session through the Vite dev-server proxy (or the production
// same-host ingress), so the Set-Cookie response lands on the FE origin. A
// cross-origin fetch to a different cloud host wouldn't include that cookie,
// so the consent challenge would 302 to login (and trip browser cross-origin
// redirect rules to boot — the symptom looks like "CORS error" on a fetch
// initiated from /oauth/authorize). The Vite proxy / production ingress is
// the single point of routing.

export type OAuthWorkspace = {
  id: string
  name: string
  type: 'personal' | 'team'
  role: 'owner' | 'member'
}

export type OAuthConsentChallenge = {
  oauth_request_id: string
  csrf_token: string
  client_display_name: string
  resource_display_name?: string
  /**
   * Exact registered redirect URI the OAuth client will be sent to on
   * success/deny. Surfaced verbatim so users can verify the destination
   * (RFC 8252 loopback for CLIs, HTTPS for web clients).
   */
  redirect_uri?: string
  /**
   * RFC 7591 application_type — "native" (CLI/desktop, loopback redirect)
   * or "web" (HTTPS-hosted). Absent for legacy seeded clients. Used to render
   * a Native / Web badge so users know what kind of app they're authorizing.
   */
  client_application_type?: 'native' | 'web'
  scopes: string[]
  workspaces: OAuthWorkspace[]
}

export type OAuthConsentDecisionParams = {
  oauthRequestId: string
  csrfToken: string
  decision: 'allow' | 'deny'
  workspaceId: string
}

export type OAuthConsentDecision = (
  params: OAuthConsentDecisionParams
) => Promise<void>

export class OAuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'OAuthApiError'
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  const message = (body as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : response.statusText
}

function assertChallenge(
  value: unknown
): asserts value is OAuthConsentChallenge {
  if (typeof value !== 'object' || value === null) {
    throw new Error('OAuth consent challenge is invalid')
  }

  const challenge = value as Partial<OAuthConsentChallenge>
  if (
    typeof challenge.oauth_request_id !== 'string' ||
    typeof challenge.csrf_token !== 'string' ||
    typeof challenge.client_display_name !== 'string' ||
    !Array.isArray(challenge.scopes) ||
    !challenge.scopes.every((scope) => typeof scope === 'string') ||
    !Array.isArray(challenge.workspaces) ||
    !challenge.workspaces.every(isValidWorkspace)
  ) {
    throw new Error('OAuth consent challenge is invalid')
  }
}

function isValidWorkspace(value: unknown): value is OAuthWorkspace {
  if (typeof value !== 'object' || value === null) return false
  const workspace = value as Partial<OAuthWorkspace>
  return (
    typeof workspace.id === 'string' &&
    typeof workspace.name === 'string' &&
    (workspace.type === 'personal' || workspace.type === 'team') &&
    (workspace.role === 'owner' || workspace.role === 'member')
  )
}

export async function fetchOAuthConsentChallenge(
  oauthRequestId: string
): Promise<OAuthConsentChallenge> {
  const response = await fetch(
    `/oauth/authorize?oauth_request_id=${encodeURIComponent(oauthRequestId)}`,
    {
      method: 'GET',
      credentials: 'include'
    }
  )

  if (!response.ok) {
    throw new OAuthApiError(await readErrorMessage(response), response.status)
  }

  const challenge: unknown = await response.json()
  assertChallenge(challenge)
  return challenge
}

export async function submitOAuthConsentDecision({
  oauthRequestId,
  csrfToken,
  decision,
  workspaceId
}: OAuthConsentDecisionParams): Promise<void> {
  const response = await fetch('/oauth/authorize', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      oauth_request_id: oauthRequestId,
      csrf_token: csrfToken,
      decision,
      workspace_id: workspaceId
    })
  })

  if (!response.ok) {
    throw new OAuthApiError(await readErrorMessage(response), response.status)
  }

  const body: unknown = await response.json()
  const redirectUrl = (body as { redirect_url?: unknown } | null)?.redirect_url
  if (typeof redirectUrl !== 'string') {
    throw new Error('OAuth consent response did not include redirect_url')
  }

  // Defense in depth: even though the cloud backend is trusted, never hand
  // the browser off to a non-http(s) scheme. javascript:/data: URLs would
  // execute in our origin.
  const target = new URL(redirectUrl, globalThis.location.origin)
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('OAuth consent redirect_url has an unsafe scheme')
  }

  globalThis.location.href = redirectUrl
}
