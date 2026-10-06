import type { SsoErrorCode } from '@comfyorg/account-core/sso'

export const SSO_ERROR_MESSAGE_KEY: Readonly<Record<SsoErrorCode, string>> = {
  SSO_UNAVAILABLE: 'auth.sso.errors.unavailable',
  SSO_LINK_CHECK_FAILED: 'auth.sso.errors.unavailable',
  SSO_CONFIRM_EXPIRED: 'auth.sso.errors.expired',
  SSO_EMAIL_DOMAIN_NOT_ALLOWED: 'auth.sso.errors.emailDomainNotAllowed',
  SSO_INVALID_STATE: 'auth.sso.errors.expired',
  SSO_NOT_CONFIGURED: 'auth.sso.errors.notConfigured',
  SSO_ORG_DISABLED: 'auth.sso.errors.orgDisabled',
  SSO_ORG_NOT_ATTACHED: 'auth.sso.errors.orgNotAttached',
  SSO_ORG_MISMATCH: 'auth.sso.errors.orgMismatch',
  SSO_USER_SUSPENDED: 'auth.sso.errors.suspended',
  SSO_ACCOUNT_DELETED: 'auth.sso.errors.accountDeleted',
  SSO_ACCOUNT_CONFLICT: 'auth.sso.errors.accountConflict',
  SSO_IDP_ERROR: 'auth.sso.errors.idpError',
  RATE_LIMITED: 'auth.sso.errors.rateLimited',
  SSO_EXCHANGE_FAILED: 'auth.sso.errors.failed',
  SSO_SIGN_IN_FAILED: 'auth.sso.errors.failed',
  SESSION_CREATION_FAILED: 'auth.sso.errors.failed',
  INTERNAL_ERROR: 'auth.sso.errors.failed'
}
