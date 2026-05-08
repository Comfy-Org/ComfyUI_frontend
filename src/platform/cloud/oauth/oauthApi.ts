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

function getOAuthOrigin(): string {
  return import.meta.env.VITE_CLOUD_INGEST_ORIGIN ?? ''
}

function oauthUrl(path: string): string {
  const origin = getOAuthOrigin()
  return origin ? new URL(path, origin).toString() : path
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
