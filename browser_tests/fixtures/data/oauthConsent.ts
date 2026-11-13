import type { ErrorResponse } from '@comfyorg/ingest-types'

export const OAUTH_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000'

/** Ingest's answer to a consent request that carries no usable session. */
export const CONSENT_LOGIN_REQUIRED: ErrorResponse = {
  code: 'login_required',
  message: 'User authentication required'
}
