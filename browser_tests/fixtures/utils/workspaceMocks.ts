import type { Page } from '@playwright/test'

import type {
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export function workspace(
  type: 'personal' | 'team',
  role: 'owner' | 'member'
): WorkspaceWithRole {
  return {
    id: `ws-${type}`,
    name: type === 'team' ? 'My Team' : 'Personal Workspace',
    type,
    role,
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z'
  }
}

export function member(
  overrides: Partial<Member> & Pick<Member, 'email' | 'role'>
): Member {
  return {
    id: `user-${overrides.email}`,
    name: overrides.email,
    joined_at: '2026-01-01T00:00:00Z',
    is_original_owner: false,
    ...overrides
  }
}

/**
 * Stub `POST /api/auth/token` with a valid workspace token for `ws`. Without
 * this the mint fails and auth cannot resolve the active workspace.
 */
export async function mockWorkspaceTokenMint(
  page: Page,
  ws: Pick<WorkspaceWithRole, 'id' | 'name' | 'type' | 'role'>
) {
  await page.route('**/api/auth/token', (r) =>
    r.fulfill(
      jsonRoute({
        token: 'mock-workspace-token',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: { id: ws.id, name: ws.name, type: ws.type },
        role: ws.role,
        permissions: []
      })
    )
  )
}

/**
 * Stub the workspace resolution + members list so the cloud app boots into the
 * given workspace with the given roster (drives the original-owner gate).
 */
export async function mockWorkspace(
  page: Page,
  ws: WorkspaceWithRole,
  members: Member[]
) {
  await page.route('**/api/workspaces', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill(jsonRoute({ workspaces: [ws] }))
  })
  await mockWorkspaceTokenMint(page, ws)
  await page.route('**/api/workspace/members**', (r) =>
    r.fulfill(
      jsonRoute({
        members,
        pagination: { offset: 0, limit: 50, total: members.length }
      })
    )
  )
}
