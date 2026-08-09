import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'

export const mockWorkspacesRemoteConfig: RemoteConfig = {
  team_workspaces_enabled: true
}

export const mockPersonalWorkspace: WorkspaceWithRole = {
  id: 'ws-personal',
  name: 'Personal Workspace',
  type: 'personal',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z',
  role: 'owner'
}

export const mockTeamWorkspace: WorkspaceWithRole = {
  id: 'ws-team',
  name: 'Team Workspace',
  type: 'team',
  created_at: '2026-01-02T00:00:00Z',
  joined_at: '2026-01-02T00:00:00Z',
  role: 'member'
}

export function makeWorkspaceTokenResponse(
  workspace: WorkspaceWithRole,
  token: string,
  expiresInMs = 60 * 60 * 1000
): WorkspaceTokenResponse {
  return {
    token,
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type
    },
    role: workspace.role,
    permissions: []
  }
}

// On app boot, teamWorkspaceStore.initialize() auto-selects Personal Workspace
// and calls switchWorkspace → /api/auth/token. This default response absorbs
// that init call so per-test mocks only see explicit switches.
export const defaultWorkspaceTokenResponse = makeWorkspaceTokenResponse(
  mockPersonalWorkspace,
  'init-token'
)
