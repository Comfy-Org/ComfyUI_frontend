import { ref, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LegacyWorkspaceTokenRailDeps } from '@/platform/workspace/stores/legacyWorkspaceTokenRail'
import { createLegacyWorkspaceTokenRail } from '@/platform/workspace/stores/legacyWorkspaceTokenRail'
import type { WorkspaceIdentity } from '@/platform/workspace/workspaceTypes'

vi.mock<unknown>(import('@/platform/auth/session/useSessionCookie'), () => ({
  useSessionCookie: () => ({ ensureSessionCookie: vi.fn() })
}))

const workspace: WorkspaceIdentity = {
  id: 'workspace-123',
  name: 'Test Workspace',
  type: 'team',
  role: 'owner'
}

const expiresInMs = 3600 * 1000

function makeDeps(): LegacyWorkspaceTokenRailDeps {
  return {
    currentWorkspace: shallowRef<WorkspaceIdentity | null>(null),
    isLoading: ref(false),
    error: ref<Error | null>(null),
    currentUserUid: vi.fn(() => 'user-a'),
    isCurrentUser: vi.fn((ownerUid: string) => ownerUid === 'user-a'),
    getIdToken: vi.fn(async () => 'firebase-token'),
    hasSignedInUser: vi.fn(() => true),
    activeWorkspaceId: vi.fn(() => null),
    switchWorkspace: vi.fn(async () => {}),
    endWorkspaceSession: vi.fn(() => false),
    persistWorkspaceIdentity: vi.fn(),
    clearSessionStorage: vi.fn(),
    surfacePermanentAuthError: vi.fn()
  }
}

describe('createLegacyWorkspaceTokenRail', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          token: 'workspace-token-abc',
          expires_at: new Date(Date.now() + expiresInMs).toISOString(),
          workspace: { id: workspace.id, name: workspace.name, type: 'team' },
          role: 'owner',
          permissions: ['owner:*']
        })
    })
    vi.stubGlobal('fetch', mockFetch)
  })

  it('mints through the identity token and persists the workspace identity', async () => {
    const deps = makeDeps()
    const rail = createLegacyWorkspaceTokenRail(deps)

    await rail.switchLegacyWorkspace('workspace-123')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/token'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer firebase-token'
        }),
        body: JSON.stringify({ workspace_id: 'workspace-123' })
      })
    )
    expect(rail.workspaceToken.value).toBe('workspace-token-abc')
    expect(deps.currentWorkspace.value).toEqual(workspace)
    expect(deps.persistWorkspaceIdentity).toHaveBeenCalledWith(workspace)
  })

  it.for([
    { owner: 'the current user', currentUser: true, valid: true },
    { owner: 'another user', currentUser: false, valid: false }
  ])(
    'a minted token is valid only while owned by $owner',
    async ({ currentUser, valid }) => {
      const deps = makeDeps()
      const rail = createLegacyWorkspaceTokenRail(deps)
      await rail.switchLegacyWorkspace('workspace-123')

      vi.mocked(deps.isCurrentUser).mockReturnValue(currentUser)

      expect(rail.hasValidWorkspaceToken()).toBe(valid)
    }
  )

  it('clears the token and the workspace identity together', async () => {
    const deps = makeDeps()
    const rail = createLegacyWorkspaceTokenRail(deps)
    await rail.switchLegacyWorkspace('workspace-123')

    rail.clearLegacyContext()

    expect(rail.workspaceToken.value).toBeNull()
    expect(deps.currentWorkspace.value).toBeNull()
    expect(rail.hasValidWorkspaceToken()).toBe(false)
  })

  it.for([
    { timer: 'armed', stop: false, refreshes: 1 },
    { timer: 'stopped', stop: true, refreshes: 0 }
  ])(
    'the refresh deadline dispatches $refreshes refresh(es) with the timer $timer',
    async ({ stop, refreshes }) => {
      const deps = makeDeps()
      const rail = createLegacyWorkspaceTokenRail(deps)
      await rail.switchLegacyWorkspace('workspace-123')

      if (stop) rail.stopRefreshTimer()
      await vi.advanceTimersByTimeAsync(expiresInMs)

      expect(deps.switchWorkspace).toHaveBeenCalledTimes(refreshes)
      expect(mockFetch).toHaveBeenCalledOnce()
    }
  )
})
