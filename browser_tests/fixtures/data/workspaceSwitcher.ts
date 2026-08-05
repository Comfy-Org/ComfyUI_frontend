import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

export const PERSONAL_WORKSPACE_NAME = 'Personal Workspace'
export const LONG_WORKSPACE_NAME =
  'Quantum Renaissance Collective for Hyperdimensional Latent Diffusion Research and Experimental Workflow Engineering'
export const TEAM_WORKSPACE_NAME = 'Team Workspace'
export const OFF_SCREEN_WORKSPACE_NAME = 'Off-screen Team Workspace'

export const WORKSPACE_SWITCHER_REMOTE_CONFIG: RemoteConfig = {
  team_workspaces_enabled: true,
  unified_cloud_auth: true
}

export const WORKSPACE_SWITCHER_WORKSPACES: WorkspaceWithRole[] = [
  {
    id: 'ws-personal',
    name: PERSONAL_WORKSPACE_NAME,
    type: 'personal',
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z',
    role: 'owner'
  },
  {
    id: 'ws-team-long',
    name: LONG_WORKSPACE_NAME,
    type: 'team',
    created_at: '2026-01-02T00:00:00Z',
    joined_at: '2026-01-02T00:00:00Z',
    role: 'member'
  },
  {
    id: 'ws-team',
    name: TEAM_WORKSPACE_NAME,
    type: 'team',
    created_at: '2026-01-03T00:00:00Z',
    joined_at: '2026-01-03T00:00:00Z',
    role: 'owner'
  }
]

/**
 * `WORKSPACE_SWITCHER_WORKSPACES` plus enough filler team workspaces to push
 * one workspace past the visible area of the switcher panel, for the scroll
 * regression test.
 */
export function createManyWorkspacesResponse(): WorkspaceWithRole[] {
  return [
    ...WORKSPACE_SWITCHER_WORKSPACES,
    ...Array.from(
      { length: 19 },
      (_, i): WorkspaceWithRole => ({
        id: `ws-many-${i}`,
        name: `Team ${i}`,
        type: 'team',
        created_at: '2026-01-04T00:00:00Z',
        joined_at: '2026-01-04T00:00:00Z',
        role: 'member'
      })
    ),
    {
      id: 'ws-off-screen',
      name: OFF_SCREEN_WORKSPACE_NAME,
      type: 'team',
      created_at: '2026-01-05T00:00:00Z',
      joined_at: '2026-01-05T00:00:00Z',
      role: 'member'
    }
  ]
}
