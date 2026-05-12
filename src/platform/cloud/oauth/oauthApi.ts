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
   * RFC 7591 application_type — "native" (CLI/desktop, loopback redirect),
   * "web" (HTTPS-hosted), or "" for legacy seeded clients. Used to render
   * a Native / Web badge so users know what kind of app they're authorizing.
   */
  client_application_type?: 'native' | 'web' | ''
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

type OAuthDecisionResponse = {
  redirect_url?: string
}

export class OAuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'OAuthApiError'
  }
}

function oauthUrl(path: string): string {
  // Relative URL — let the Vite dev-server proxy (same origin as the FE)
  // or the production same-host deploy hit ingest.
  //
  // Going direct cross-origin via VITE_CLOUD_INGEST_ORIGIN is a footgun:
  // useSessionCookie POSTs /api/auth/session through the proxy, so the
  // Set-Cookie response lands on the FE origin. A cross-origin fetch to
  // a different cloud host wouldn't include that cookie, so the consent
  // challenge would 302 to login (and trip browser cross-origin redirect
  // rules to boot — the symptom looks like "CORS error" on a fetch
  // initiated from /oauth/authorize).
  //
  // Keep all OAuth calls same-origin. The Vite proxy / production
  // ingress is the single point of routing.
  return path
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.message ?? response.statusText
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
    !Array.isArray(challenge.workspaces)
  ) {
    throw new Error('OAuth consent challenge is invalid')
  }
}

export async function fetchOAuthConsentChallenge(
  oauthRequestId: string
): Promise<OAuthConsentChallenge> {
  const response = await fetch(
    oauthUrl(`/oauth/authorize?oauth_request_id=${oauthRequestId}`),
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
  const response = await fetch(oauthUrl('/oauth/authorize'), {
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

  const body: OAuthDecisionResponse = await response.json()
  if (!body.redirect_url) {
    throw new Error('OAuth consent response did not include redirect_url')
  }

  globalThis.location.href = body.redirect_url
}
