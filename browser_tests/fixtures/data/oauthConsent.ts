import type { ErrorResponse } from '@comfyorg/ingest-types'

import type { OAuthConsentChallenge } from '@/platform/cloud/oauth/oauthApi'

export const OAUTH_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000'

export const CONSENT_CHALLENGE: OAuthConsentChallenge = {
  client_provenance: 'first_party',
  oauth_request_id: OAUTH_REQUEST_ID,
  csrf_token: 'csrf-token',
  client_display_name: 'Comfy Desktop',
  resource_display_name: 'Comfy Cloud',
  redirect_uri: 'http://127.0.0.1:50632/callback',
  client_application_type: 'native',
  scopes: ['comfy-cloud:user:read'],
  workspaces: [
    {
      id: 'personal-workspace',
      name: 'Personal',
      type: 'personal',
      role: 'owner'
    }
  ]
}

export const CONSENT_UNAUTHORIZED: ErrorResponse = {
  code: 'UNAUTHORIZED',
  message: 'User authentication required'
}

export const SESSION_CREATE_FAILED: ErrorResponse = {
  code: 'internal_error',
  message: 'Session creation failed'
}
