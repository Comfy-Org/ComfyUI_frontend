export type WorkspaceRole = 'owner' | 'member'

export interface WorkspaceWithRole {
  id: string
  name: string
  type: 'personal' | 'team'
  role: WorkspaceRole
}

export interface WorkspaceTokenResponse {
  token: string
  expires_at: string
  workspace: {
    id: string
    name: string
    type: 'personal' | 'team'
  }
  role: WorkspaceRole
  permissions: string[]
}

export interface ListWorkspacesResponse {
  workspaces: WorkspaceWithRole[]
}
