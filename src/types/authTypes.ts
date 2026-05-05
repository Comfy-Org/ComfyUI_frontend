type LoggedInAuthHeader = {
  Authorization: `Bearer ${string}`
}

export type ApiKeyAuthHeader = {
  'X-API-KEY': string
}

export type AuthHeader = LoggedInAuthHeader | ApiKeyAuthHeader

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
