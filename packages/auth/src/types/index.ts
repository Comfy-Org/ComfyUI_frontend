type LoggedInAuthHeader = {
  Authorization: `Bearer ${string}`
}

export type ApiKeyAuthHeader = {
  'X-API-KEY': string
}

export type AuthHeader = LoggedInAuthHeader | ApiKeyAuthHeader

export interface AuthUserInfo {
  id: string
}

/**
 * Represents a workspace with the user's role in it.
 */
export interface WorkspaceWithRole {
  id: string
  name: string
  type: 'personal' | 'team'
  role: 'owner' | 'member'
}
