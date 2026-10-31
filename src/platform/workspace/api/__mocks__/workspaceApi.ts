import { vi } from 'vitest'

import type { workspaceApi as realWorkspaceApi } from '@/platform/workspace/api/workspaceApi'

export const workspaceApi = vi.mockObject<typeof realWorkspaceApi>(
  {
    list: async () => ({
      workspaces: [],
      can_create_workspace: true,
      max_owned_workspaces: 1
    }),
    getCurrentWorkspace: async () => ({
      id: 'workspace-1',
      name: 'Personal',
      type: 'personal',
      role: 'owner',
      auth_method: 'cloud_jwt'
    }),
    create: async ({ name }) => ({
      id: 'workspace-1',
      name,
      type: 'team',
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z'
    }),
    update: async (id, { name }) => ({
      id,
      name: name ?? 'Team',
      type: 'team',
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z'
    }),
    listDeployments: async () => ({ items: [], builds_visible: true }),
    pickDeployment: async () => {},
    clearDeployment: async () => {},
    startDeployment: async () => ({ deployment_id: '', status: 'starting' }),
    setDefaultDeployment: async () => {},
    clearDefaultDeployment: async () => {},
    getDeploymentCpuServer: async () => ({ cpu_server: 'none' }),
    getReleaseUnsupportedPacks: async () => ({ release_id: null, packs: [] }),
    checkDeploymentCompatibility: async () => ({
      deployments: [],
      cloud: { missing_node_types: [] }
    }),
    delete: async () => {},
    leave: async () => {},
    listMembers: async () => ({
      members: [],
      pagination: { has_more: false, limit: 20, offset: 0, total: 0 }
    }),
    removeMember: async () => {},
    updateMemberRole: async (id, role) => ({
      id,
      role,
      name: 'Member',
      email: 'member@example.com',
      is_original_owner: false,
      joined_at: '2026-01-01T00:00:00Z'
    }),
    listInvites: async () => ({ invites: [] }),
    createInvite: async ({ email }) => ({
      id: 'invite-1',
      email,
      invited_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-08T00:00:00Z'
    }),
    revokeInvite: async () => {},
    resendInvite: async (id) => ({
      id,
      email: 'member@example.com',
      invited_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-08T00:00:00Z'
    }),
    acceptInvite: async () => ({
      workspace_id: 'workspace-1',
      workspace_name: 'Team'
    })
  },
  { spy: true }
)
