/**
 * Shared telemetry vocabulary. The event names match the cloud app's
 * TelemetryEvents verbatim so an auth outcome is one queryable event across
 * every host. The package never calls a telemetry API itself; call sites
 * stay host-specific.
 */
export const SESSION_TELEMETRY_EVENT = {
  refreshSucceeded: 'auth.unified.refresh.succeeded',
  refreshFailed: 'auth.unified.refresh.failed'
} as const

export const AUTH_TELEMETRY_EVENT = {
  signUpOpened: 'app:user_sign_up_opened',
  authCompleted: 'app:user_auth_completed',
  authFailed: 'app:user_auth_failed'
} as const

export type AuthMethod = 'email' | 'google' | 'github'

/** What the cloud app reports on every successful credential. */
export interface AuthCompletedMetadata {
  method: AuthMethod
  is_new_user: boolean
  user_id: string
  email?: string
}

export type AuthFlowAction =
  | 'email_sign_in'
  | 'email_sign_up'
  | 'google_sign_in'
  | 'google_sign_up'
  | 'github_sign_in'
  | 'github_sign_up'
  | 'password_reset'

export interface AuthErrorMetadata {
  error_code: string
  auth_action: AuthFlowAction
}
