import { vi } from 'vitest'

import type { projectsApi as realProjectsApi } from '@/platform/workspace/api/projectsApi'
import {
  listProjectsAtLimit,
  listProjectsByRole,
  projectAsOwner,
  projectMembers,
  workspaceAdminMember,
  workspaceMember
} from '@/platform/workspace/api/__fixtures__/projects'

export const projectsApi = vi.mockObject<typeof realProjectsApi>(
  {
    list: async () => listProjectsByRole.owner,
    get: async (id) =>
      listProjectsAtLimit.projects.find((project) => project.id === id) ??
      projectAsOwner,
    create: async ({ name }) => ({ ...projectAsOwner, name }),
    update: async (id, payload) => ({
      ...projectAsOwner,
      id,
      ...payload
    }),
    listMembers: async () => projectMembers,
    setMember: async (_projectId, userId, { role }) => ({
      user_id: userId,
      name: 'Member',
      email: 'member@example.com',
      role,
      create_time: '2026-01-01T00:00:00Z'
    }),
    removeMember: async () => {},
    grantWorkspaceAdmin: async () => workspaceAdminMember,
    revokeWorkspaceAdmin: async () => workspaceMember
  },
  { spy: true }
)
