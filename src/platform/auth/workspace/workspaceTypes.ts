export interface WorkspaceWithRole {
  id: string
  name: string
  type: 'personal' | 'team'
  role: 'owner' | 'member'
}

export interface WorkspaceTokenResponse {
  token: string
  expires_at: string
  workspace: {
    id: string
    name: string
    type: 'personal' | 'team'
  }
  role: 'owner' | 'member'
  permissions: string[]
}
