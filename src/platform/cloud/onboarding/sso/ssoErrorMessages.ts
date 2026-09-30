import type { SsoErrorCode } from '@comfyorg/account-core/sso'

type SsoErrorMessageKey =
  | 'unavailable'
  | 'expired'
  | 'notConfigured'
  | 'orgDisabled'
  | 'orgNotReady'
  | 'orgMismatch'
  | 'notProvisioned'
  | 'suspended'
  | 'accountDeleted'
  | 'accountConflict'
  | 'idpError'
  | 'rateLimited'
  | 'failed'

const MESSAGE_FOR_CODE: Readonly<
  Record<SsoErrorCode | 'unknown', SsoErrorMessageKey>
> = {
  SSO_UNAVAILABLE: 'unavailable',
  SSO_LINK_CHECK_FAILED: 'unavailable',
  SSO_CONFIRM_EXPIRED: 'expired',
  SSO_INVALID_STATE: 'expired',
  SSO_NOT_CONFIGURED: 'notConfigured',
  SSO_ORG_DISABLED: 'orgDisabled',
  SSO_ORG_NOT_ATTACHED: 'orgNotReady',
  SSO_ORG_MISMATCH: 'orgMismatch',
  SSO_NOT_PROVISIONED: 'notProvisioned',
  SSO_USER_SUSPENDED: 'suspended',
  SSO_ACCOUNT_DELETED: 'accountDeleted',
  SSO_ACCOUNT_CONFLICT: 'accountConflict',
  SSO_IDP_ERROR: 'idpError',
  SSO_EXCHANGE_FAILED: 'failed',
  SSO_SIGN_IN_FAILED: 'failed',
  SESSION_CREATION_FAILED: 'failed',
  INTERNAL_ERROR: 'failed',
  RATE_LIMITED: 'rateLimited',
  unknown: 'failed'
}

export function ssoErrorMessageKey(code: SsoErrorCode | 'unknown'): string {
  return `auth.sso.errors.${MESSAGE_FOR_CODE[code]}`
}
