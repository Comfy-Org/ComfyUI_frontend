import type {
  ErrorResponse,
  SsoDiscoverResponse,
  WebSessionResponse
} from '@comfyorg/ingest-types'

import { WEB_SESSION } from '@e2e/fixtures/data/webSession'

export const SSO_EMAIL = 'ada@acme.example'

export const SSO_DISCOVERED: SsoDiscoverResponse = {
  sso: true,
  organization_name: 'Acme'
}

export const NOT_SSO: SsoDiscoverResponse = { sso: false }

export const SSO_DISCOVER_DOWN: ErrorResponse = {
  code: 'internal_error',
  message: 'discover is down'
}

export const SSO_REQUIRED: ErrorResponse = {
  code: 'sso_required',
  message: 'This account signs in with SSO'
}

export const SSO_WEB_SESSION: WebSessionResponse = {
  ...WEB_SESSION,
  user: { ...WEB_SESSION.user, sign_in_provider: 'saml.workos' }
}
