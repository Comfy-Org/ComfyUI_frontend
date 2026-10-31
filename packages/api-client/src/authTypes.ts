export type LoggedInAuthHeader = {
  Authorization: `Bearer ${string}`
}

export type ApiKeyAuthHeader = {
  'X-API-KEY': string
}

export type AuthHeader = LoggedInAuthHeader | ApiKeyAuthHeader

/**
 * Which cloud auth path a request actually took, for error diagnostics.
 *
 * `none` means no auth scheme was used at all, which covers both a non-cloud
 * distribution and a cloud request whose auth header was unavailable. Those are
 * the same statement about the request - nothing authenticated it - and the
 * deploy surface already distinguishes them, so this stays three values rather
 * than growing a fourth that only restates `isCloud`.
 */
export type AuthScheme = 'web-session' | 'cloud-auth-header' | 'none'

/** What credential a request carried, for telemetry; never the credential itself. */
export type AuthCredential = 'session-cookie' | 'bearer' | 'api-key' | 'none'

/**
 * Identifier for an authenticated user.
 *
 * Backed by the `id` claim returned from the auth provider, which is always
 * a string. This alias names that primitive at use sites (auth store,
 * workspace member APIs) without changing structural typing.
 */
export type UserId = string

export interface AuthUserInfo {
  id: UserId
}
