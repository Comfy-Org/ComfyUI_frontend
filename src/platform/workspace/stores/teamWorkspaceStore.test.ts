import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTeamWorkspaceStore } from './teamWorkspaceStore'

// Mock sessionManager
const mockSessionManager = vi.hoisted(() => ({
  getCurrentWorkspaceId: vi.fn(),
  setCurrentWorkspaceId: vi.fn(),
  clearCurrentWorkspaceId: vi.fn(),
  getLastWorkspaceId: vi.fn(),
  setLastWorkspaceId: vi.fn(),
  clearLastWorkspaceId: vi.fn(),
  getWorkspaceToken: vi.fn(),
  setWorkspaceToken: vi.fn(),
  clearWorkspaceToken: vi.fn(),
  switchWorkspaceAndReload: vi.fn(),
  clearAndReload: vi.fn()
}))

vi.mock('../services/sessionManager', () => ({
  sessionManager: mockSessionManager
}))

// Mock workspaceApi
const mockWorkspaceApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  leave: vi.fn(),
  listMembers: vi.fn(),
  removeMember: vi.fn(),
  listInvites: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  acceptInvite: vi.fn(),
  exchangeToken: vi.fn(),
  getBillingPortalUrl: vi.fn()
}))

const mockWorkspaceApiError = vi.hoisted(
  () =>
    class WorkspaceApiError extends Error {
      constructor(
        message: string,
        public readonly status?: number,
        public readonly code?: string
      ) {
        super(message)
        this.name = 'WorkspaceApiError'
      }
    }
)

vi.mock('../api/workspaceApi', () => ({
  workspaceApi: mockWorkspaceApi,
  WorkspaceApiError: mockWorkspaceApiError
}))

// Test data
const mockPersonalWorkspace = {
  id: 'ws-personal-123',
  name: 'Personal',
  type: 'personal' as const,
  role: 'owner' as const
}

const mockTeamWorkspace = {
  id: 'ws-team-456',
  name: 'Team Alpha',
  type: 'team' as const,
  role: 'owner' as const
}

const mockMemberWorkspace = {
  id: 'ws-team-789',
  name: 'Team Beta',
  type: 'team' as const,
  role: 'member' as const
}

const mockTokenResponse = {
  token: 'workspace-token-abc',
  expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  workspace: {
    id: mockTeamWorkspace.id,
    name: mockTeamWorkspace.name,
    type: mockTeamWorkspace.type
  },
  role: 'owner' as const,
  permissions: ['owner:*']
}

describe('useTeamWorkspaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    sessionStorage.clear()

    // Default mock responses
    mockWorkspaceApi.list.mockResolvedValue({
      workspaces: [mockPersonalWorkspace, mockTeamWorkspace]
    })
    mockWorkspaceApi.exchangeToken.mockResolvedValue(mockTokenResponse)
    mockSessionManager.getCurrentWorkspaceId.mockReturnValue(null)
    mockSessionManager.getLastWorkspaceId.mockReturnValue(null)
    mockSessionManager.getWorkspaceToken.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const store = useTeamWorkspaceStore()

      expect(store.initState).toBe('uninitialized')
      expect(store.workspaces).toEqual([])
      expect(store.activeWorkspaceId).toBeNull()
      expect(store.error).toBeNull()
      expect(store.isCreating).toBe(false)
      expect(store.isDeleting).toBe(false)
      expect(store.isSwitching).toBe(false)
      expect(store.isFetchingWorkspaces).toBe(false)
    })

    it('computed properties return correct defaults', () => {
      const store = useTeamWorkspaceStore()

      expect(store.activeWorkspace).toBeNull()
      expect(store.personalWorkspace).toBeNull()
      expect(store.isInPersonalWorkspace).toBe(false)
      expect(store.sharedWorkspaces).toEqual([])
      expect(store.ownedWorkspacesCount).toBe(0)
      expect(store.canCreateWorkspace).toBe(true)
      expect(store.members).toEqual([])
      expect(store.pendingInvites).toEqual([])
    })
  })

  describe('initialize', () => {
    it('fetches workspaces and sets active workspace to personal by default', async () => {
      const store = useTeamWorkspaceStore()

      await store.initialize()

      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(1)
      expect(store.initState).toBe('ready')
      expect(store.workspaces).toHaveLength(2)
      expect(store.activeWorkspaceId).toBe(mockPersonalWorkspace.id)
      expect(mockSessionManager.setCurrentWorkspaceId).toHaveBeenCalledWith(
        mockPersonalWorkspace.id
      )
      expect(mockSessionManager.setLastWorkspaceId).toHaveBeenCalledWith(
        mockPersonalWorkspace.id
      )
    })

    it('restores workspace from sessionStorage if valid', async () => {
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockTeamWorkspace.id)
    })

    it('falls back to localStorage if sessionStorage is empty', async () => {
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(null)
      mockSessionManager.getLastWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockTeamWorkspace.id)
    })

    it('falls back to personal if stored workspace not in list', async () => {
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        'non-existent-workspace'
      )
      mockSessionManager.getLastWorkspaceId.mockReturnValue(
        'another-non-existent'
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockPersonalWorkspace.id)
    })

    it('restores valid token from sessionStorage', async () => {
      const futureExpiry = Date.now() + 3600 * 1000
      mockSessionManager.getWorkspaceToken.mockReturnValue({
        token: 'cached-token',
        expiresAt: futureExpiry
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      // Should not call exchangeToken since we have a valid cached token
      expect(mockWorkspaceApi.exchangeToken).not.toHaveBeenCalled()
    })

    it('exchanges token if cached token is expired', async () => {
      const pastExpiry = Date.now() - 1000
      mockSessionManager.getWorkspaceToken.mockReturnValue({
        token: 'expired-token',
        expiresAt: pastExpiry
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledWith(
        mockPersonalWorkspace.id
      )
    })

    it('sets error state when workspaces fetch fails', async () => {
      mockWorkspaceApi.list.mockRejectedValue(new Error('Network error'))

      const store = useTeamWorkspaceStore()

      await expect(store.initialize()).rejects.toThrow('Network error')
      expect(store.initState).toBe('error')
      expect(store.error).toBeInstanceOf(Error)
    })

    it('does not reinitialize if already initialized', async () => {
      const store = useTeamWorkspaceStore()

      await store.initialize()
      await store.initialize()

      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(1)
    })

    it('throws when no workspaces available', async () => {
      mockWorkspaceApi.list.mockResolvedValue({ workspaces: [] })

      const store = useTeamWorkspaceStore()

      await expect(store.initialize()).rejects.toThrow(
        'No workspaces available'
      )
      expect(store.initState).toBe('error')
    })
  })

  describe('token refresh scheduling', () => {
    it('schedules token refresh 5 minutes before expiry', async () => {
      const now = Date.now()
      const expiresInMs = 3600 * 1000 // 1 hour
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(now + expiresInMs).toISOString()
      }

      // Return very far future expiry on refresh to prevent another refresh cycle
      const farFutureResponse = {
        ...mockTokenResponse,
        expires_at: new Date(now + 24 * 3600 * 1000).toISOString() // 24 hours
      }

      mockWorkspaceApi.exchangeToken
        .mockResolvedValueOnce(tokenResponseWithFutureExpiry) // Initial
        .mockResolvedValue(farFutureResponse) // All subsequent

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(1)

      // Advance time to just before refresh (55 minutes)
      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs

      vi.advanceTimersByTime(refreshDelay - 1)
      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(1)

      // Advance to trigger refresh
      await vi.advanceTimersByTimeAsync(2)
      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(2)
    })

    it('retries with exponential backoff on transient failures', async () => {
      const now = Date.now()
      const expiresInMs = 3600 * 1000
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(now + expiresInMs).toISOString()
      }

      // Return very far future expiry on success to prevent another refresh cycle
      const farFutureResponse = {
        ...mockTokenResponse,
        expires_at: new Date(now + 24 * 3600 * 1000).toISOString()
      }

      // First call succeeds (initialization), then fail twice, then succeed with far future
      mockWorkspaceApi.exchangeToken
        .mockResolvedValueOnce(tokenResponseWithFutureExpiry) // Initial
        .mockRejectedValueOnce(new Error('Network error')) // Refresh attempt 1
        .mockRejectedValueOnce(new Error('Network error')) // Retry 1
        .mockResolvedValueOnce(farFutureResponse) // Retry 2 succeeds

      const store = useTeamWorkspaceStore()
      await store.initialize()
      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(1)

      // Advance to trigger refresh
      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs
      await vi.advanceTimersByTimeAsync(refreshDelay)

      // First attempt fires immediately, then waits 1s for retry
      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(2)

      // Wait for first retry (1s backoff)
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(3)

      // Wait for second retry (2s backoff)
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(4)
    })

    it('clears context when refresh fails with ACCESS_DENIED', async () => {
      const expiresInMs = 3600 * 1000
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(Date.now() + expiresInMs).toISOString()
      }

      mockWorkspaceApi.exchangeToken
        .mockResolvedValueOnce(tokenResponseWithFutureExpiry)
        .mockRejectedValueOnce(
          new mockWorkspaceApiError('Access denied', 403, 'ACCESS_DENIED')
        )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(mockSessionManager.setWorkspaceToken).toHaveBeenCalled()

      // Advance to trigger refresh
      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs
      await vi.advanceTimersByTimeAsync(refreshDelay + 100)

      // Should clear token on permanent error
      expect(mockSessionManager.clearWorkspaceToken).toHaveBeenCalled()
    })

    it('aborts stale refresh when workspace context changes', async () => {
      const expiresInMs = 3600 * 1000
      const tokenResponseWithFutureExpiry = {
        ...mockTokenResponse,
        expires_at: new Date(Date.now() + expiresInMs).toISOString()
      }
      mockWorkspaceApi.exchangeToken.mockResolvedValue(
        tokenResponseWithFutureExpiry
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      // Start refresh timer, then switch workspace (which clears token context)
      const refreshBufferMs = 5 * 60 * 1000
      const refreshDelay = expiresInMs - refreshBufferMs

      // Advance partway
      vi.advanceTimersByTime(refreshDelay - 1000)

      // Switch workspace clears token context and increments request ID
      await store.switchWorkspace(mockTeamWorkspace.id)

      // Advance past when refresh would have fired
      await vi.advanceTimersByTimeAsync(2000)

      // exchangeToken should only have been called once (during init)
      // because switchWorkspace triggers a reload, not another exchange
      expect(mockWorkspaceApi.exchangeToken).toHaveBeenCalledTimes(1)
    })
  })

  describe('switchWorkspace', () => {
    it('does nothing if switching to current workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      const currentId = store.activeWorkspaceId
      await store.switchWorkspace(currentId!)

      expect(mockSessionManager.switchWorkspaceAndReload).not.toHaveBeenCalled()
    })

    it('calls switchWorkspaceAndReload for valid workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.switchWorkspace(mockTeamWorkspace.id)

      expect(mockSessionManager.switchWorkspaceAndReload).toHaveBeenCalledWith(
        mockTeamWorkspace.id
      )
    })

    it('sets isSwitching flag during operation', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.isSwitching).toBe(false)

      const switchPromise = store.switchWorkspace(mockTeamWorkspace.id)
      expect(store.isSwitching).toBe(true)

      await switchPromise
      // Note: isSwitching stays true because page reloads
    })

    it('refreshes workspace list if target not found', async () => {
      const newWorkspace = {
        id: 'ws-new-999',
        name: 'New Workspace',
        type: 'team' as const,
        role: 'member' as const
      }

      // First list returns without new workspace
      mockWorkspaceApi.list
        .mockResolvedValueOnce({
          workspaces: [mockPersonalWorkspace, mockTeamWorkspace]
        })
        // Second list (refresh) includes new workspace
        .mockResolvedValueOnce({
          workspaces: [mockPersonalWorkspace, mockTeamWorkspace, newWorkspace]
        })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.switchWorkspace(newWorkspace.id)

      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(2)
      expect(mockSessionManager.switchWorkspaceAndReload).toHaveBeenCalledWith(
        newWorkspace.id
      )
    })

    it('throws if workspace not found after refresh', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      await expect(
        store.switchWorkspace('non-existent-workspace')
      ).rejects.toThrow('Workspace not found or access denied')

      expect(store.isSwitching).toBe(false)
    })
  })

  describe('createWorkspace', () => {
    it('creates workspace and triggers reload', async () => {
      const newWorkspace = {
        id: 'ws-new-created',
        name: 'Created Workspace',
        type: 'team' as const,
        role: 'owner' as const
      }
      mockWorkspaceApi.create.mockResolvedValue(newWorkspace)

      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.createWorkspace('Created Workspace')

      expect(mockWorkspaceApi.create).toHaveBeenCalledWith({
        name: 'Created Workspace'
      })
      expect(result.id).toBe(newWorkspace.id)
      expect(store.workspaces).toContainEqual(
        expect.objectContaining({ id: newWorkspace.id })
      )
      expect(mockSessionManager.switchWorkspaceAndReload).toHaveBeenCalledWith(
        newWorkspace.id
      )
    })

    it('sets isCreating flag during operation', async () => {
      let resolveCreate: (value: unknown) => void
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve
      })
      mockWorkspaceApi.create.mockReturnValue(createPromise)

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.isCreating).toBe(false)

      const resultPromise = store.createWorkspace('New Workspace')
      expect(store.isCreating).toBe(true)

      resolveCreate!({
        id: 'ws-new',
        name: 'New Workspace',
        type: 'team',
        role: 'owner'
      })
      await resultPromise
    })

    it('resets isCreating on error', async () => {
      mockWorkspaceApi.create.mockRejectedValue(new Error('Creation failed'))

      const store = useTeamWorkspaceStore()
      await store.initialize()

      await expect(store.createWorkspace('New Workspace')).rejects.toThrow(
        'Creation failed'
      )
      expect(store.isCreating).toBe(false)
    })
  })

  describe('deleteWorkspace', () => {
    it('deletes non-active workspace without reload', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      // Active is personal, delete team workspace
      expect(store.activeWorkspaceId).toBe(mockPersonalWorkspace.id)

      await store.deleteWorkspace(mockTeamWorkspace.id)

      expect(mockWorkspaceApi.delete).toHaveBeenCalledWith(mockTeamWorkspace.id)
      expect(store.workspaces).not.toContainEqual(
        expect.objectContaining({ id: mockTeamWorkspace.id })
      )
      expect(mockSessionManager.switchWorkspaceAndReload).not.toHaveBeenCalled()
    })

    it('deletes active workspace and reloads to personal', async () => {
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockTeamWorkspace.id)

      await store.deleteWorkspace()

      expect(mockWorkspaceApi.delete).toHaveBeenCalledWith(mockTeamWorkspace.id)
      expect(mockSessionManager.switchWorkspaceAndReload).toHaveBeenCalledWith(
        mockPersonalWorkspace.id
      )
    })

    it('throws when trying to delete personal workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      await expect(
        store.deleteWorkspace(mockPersonalWorkspace.id)
      ).rejects.toThrow('Cannot delete personal workspace')
    })

    it('throws when workspace not found', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      await expect(store.deleteWorkspace('non-existent')).rejects.toThrow(
        'Workspace not found'
      )
    })
  })

  describe('renameWorkspace', () => {
    it('updates workspace name locally', async () => {
      mockWorkspaceApi.update.mockResolvedValue({
        ...mockTeamWorkspace,
        name: 'Renamed Workspace'
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.renameWorkspace(mockTeamWorkspace.id, 'Renamed Workspace')

      expect(mockWorkspaceApi.update).toHaveBeenCalledWith(
        mockTeamWorkspace.id,
        {
          name: 'Renamed Workspace'
        }
      )

      const updated = store.workspaces.find(
        (w) => w.id === mockTeamWorkspace.id
      )
      expect(updated?.name).toBe('Renamed Workspace')
    })
  })

  describe('leaveWorkspace', () => {
    it('leaves workspace and reloads to personal', async () => {
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockMemberWorkspace.id
      )
      mockWorkspaceApi.list.mockResolvedValue({
        workspaces: [mockPersonalWorkspace, mockMemberWorkspace]
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.leaveWorkspace()

      expect(mockWorkspaceApi.leave).toHaveBeenCalled()
      expect(mockSessionManager.switchWorkspaceAndReload).toHaveBeenCalledWith(
        mockPersonalWorkspace.id
      )
    })

    it('throws when trying to leave personal workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      // Active is personal by default
      await expect(store.leaveWorkspace()).rejects.toThrow(
        'Cannot leave personal workspace'
      )
    })
  })

  describe('computed properties', () => {
    it('activeWorkspace returns correct workspace', async () => {
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspace?.id).toBe(mockTeamWorkspace.id)
      expect(store.activeWorkspace?.name).toBe(mockTeamWorkspace.name)
    })

    it('personalWorkspace returns personal workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.personalWorkspace?.id).toBe(mockPersonalWorkspace.id)
      expect(store.personalWorkspace?.type).toBe('personal')
    })

    it('isInPersonalWorkspace returns true when in personal', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.isInPersonalWorkspace).toBe(true)
    })

    it('isInPersonalWorkspace returns false when in team', async () => {
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.isInPersonalWorkspace).toBe(false)
    })

    it('sharedWorkspaces excludes personal workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.sharedWorkspaces).toHaveLength(1)
      expect(store.sharedWorkspaces[0].id).toBe(mockTeamWorkspace.id)
    })

    it('ownedWorkspacesCount counts owned workspaces', async () => {
      mockWorkspaceApi.list.mockResolvedValue({
        workspaces: [
          mockPersonalWorkspace,
          mockTeamWorkspace,
          mockMemberWorkspace
        ]
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      // personal (owner) + team (owner) = 2, member workspace doesn't count
      expect(store.ownedWorkspacesCount).toBe(2)
    })

    it('canCreateWorkspace respects limit', async () => {
      // Create 10 owned workspaces (max limit)
      const manyWorkspaces = Array.from({ length: 10 }, (_, i) => ({
        id: `ws-owned-${i}`,
        name: `Owned ${i}`,
        type: 'team' as const,
        role: 'owner' as const
      }))

      mockWorkspaceApi.list.mockResolvedValue({
        workspaces: [mockPersonalWorkspace, ...manyWorkspaces]
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.ownedWorkspacesCount).toBe(11) // personal + 10
      expect(store.canCreateWorkspace).toBe(false)
    })
  })

  describe('member actions', () => {
    it('fetchMembers updates active workspace members', async () => {
      const mockMembers = [
        {
          id: 'user-1',
          name: 'User One',
          email: 'one@test.com',
          joined_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'user-2',
          name: 'User Two',
          email: 'two@test.com',
          joined_at: '2024-01-02T00:00:00Z'
        }
      ]
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: mockMembers,
        pagination: { offset: 0, limit: 50, total: 2 }
      })
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.fetchMembers()

      expect(result).toHaveLength(2)
      expect(store.members).toHaveLength(2)
      expect(store.members[0].name).toBe('User One')
    })

    it('fetchMembers returns empty for personal workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.fetchMembers()

      expect(result).toEqual([])
      expect(mockWorkspaceApi.listMembers).not.toHaveBeenCalled()
    })

    it('removeMember removes from local list', async () => {
      const mockMembers = [
        {
          id: 'user-1',
          name: 'User One',
          email: 'one@test.com',
          joined_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'user-2',
          name: 'User Two',
          email: 'two@test.com',
          joined_at: '2024-01-02T00:00:00Z'
        }
      ]
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: mockMembers,
        pagination: { offset: 0, limit: 50, total: 2 }
      })
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()

      expect(store.members).toHaveLength(2)

      await store.removeMember('user-1')

      expect(mockWorkspaceApi.removeMember).toHaveBeenCalledWith('user-1')
      expect(store.members).toHaveLength(1)
      expect(store.members[0].id).toBe('user-2')
    })
  })

  describe('invite actions', () => {
    it('fetchPendingInvites updates active workspace invites', async () => {
      const mockInvites = [
        {
          id: 'inv-1',
          email: 'invite@test.com',
          token: 'token-abc',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        }
      ]
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: mockInvites })
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.fetchPendingInvites()

      expect(result).toHaveLength(1)
      expect(store.pendingInvites).toHaveLength(1)
      expect(store.pendingInvites[0].email).toBe('invite@test.com')
    })

    it('createInvite adds to local list', async () => {
      const newInvite = {
        id: 'inv-new',
        email: 'new@test.com',
        token: 'token-new',
        invited_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-08T00:00:00Z'
      }
      mockWorkspaceApi.createInvite.mockResolvedValue(newInvite)
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.createInvite('new@test.com')

      expect(mockWorkspaceApi.createInvite).toHaveBeenCalledWith({
        email: 'new@test.com'
      })
      expect(result.email).toBe('new@test.com')
      expect(store.pendingInvites).toContainEqual(
        expect.objectContaining({ email: 'new@test.com' })
      )
    })

    it('revokeInvite removes from local list', async () => {
      const mockInvites = [
        {
          id: 'inv-1',
          email: 'one@test.com',
          token: 'token-1',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        },
        {
          id: 'inv-2',
          email: 'two@test.com',
          token: 'token-2',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        }
      ]
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: mockInvites })
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchPendingInvites()

      await store.revokeInvite('inv-1')

      expect(mockWorkspaceApi.revokeInvite).toHaveBeenCalledWith('inv-1')
      expect(store.pendingInvites).toHaveLength(1)
      expect(store.pendingInvites[0].id).toBe('inv-2')
    })

    it('acceptInvite refreshes workspace list', async () => {
      mockWorkspaceApi.acceptInvite.mockResolvedValue({
        workspace_id: 'ws-joined',
        workspace_name: 'Joined Workspace'
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.acceptInvite('invite-token')

      expect(mockWorkspaceApi.acceptInvite).toHaveBeenCalledWith('invite-token')
      expect(result.workspaceId).toBe('ws-joined')
      expect(result.workspaceName).toBe('Joined Workspace')
      // list is called twice: once in init, once after accept
      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(2)
    })
  })

  describe('invite link helpers', () => {
    it('getInviteLink returns link for existing invite', async () => {
      const mockInvites = [
        {
          id: 'inv-1',
          email: 'test@test.com',
          token: 'secret-token',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        }
      ]
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: mockInvites })
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchPendingInvites()

      const link = store.getInviteLink('inv-1')

      expect(link).toContain('?invite=secret-token')
    })

    it('getInviteLink returns null for non-existent invite', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      const link = store.getInviteLink('non-existent')

      expect(link).toBeNull()
    })

    it('createInviteLink creates invite and returns link', async () => {
      const newInvite = {
        id: 'inv-new',
        email: 'new@test.com',
        token: 'new-token',
        invited_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-08T00:00:00Z'
      }
      mockWorkspaceApi.createInvite.mockResolvedValue(newInvite)
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      const link = await store.createInviteLink('new@test.com')

      expect(link).toContain('?invite=new-token')
    })
  })

  describe('cleanup', () => {
    it('destroy clears token context and stops refresh timer', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      store.destroy()

      expect(mockSessionManager.clearWorkspaceToken).toHaveBeenCalled()
    })
  })

  describe('totalMemberSlots and isInviteLimitReached', () => {
    it('calculates total slots from members and invites', async () => {
      const mockMembers = [
        {
          id: 'user-1',
          name: 'User One',
          email: 'one@test.com',
          joined_at: '2024-01-01T00:00:00Z'
        }
      ]
      const mockInvites = [
        {
          id: 'inv-1',
          email: 'invite@test.com',
          token: 'token-1',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        },
        {
          id: 'inv-2',
          email: 'invite2@test.com',
          token: 'token-2',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        }
      ]
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: mockMembers,
        pagination: { offset: 0, limit: 50, total: 1 }
      })
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: mockInvites })
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()
      await store.fetchPendingInvites()

      expect(store.totalMemberSlots).toBe(3) // 1 member + 2 invites
      expect(store.isInviteLimitReached).toBe(false)
    })

    it('isInviteLimitReached returns true at 50 slots', async () => {
      const mockMembers = Array.from({ length: 48 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
        email: `user${i}@test.com`,
        joined_at: '2024-01-01T00:00:00Z'
      }))
      const mockInvites = [
        {
          id: 'inv-1',
          email: 'invite1@test.com',
          token: 'token-1',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        },
        {
          id: 'inv-2',
          email: 'invite2@test.com',
          token: 'token-2',
          invited_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        }
      ]
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: mockMembers,
        pagination: { offset: 0, limit: 50, total: 48 }
      })
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: mockInvites })
      mockSessionManager.getCurrentWorkspaceId.mockReturnValue(
        mockTeamWorkspace.id
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()
      await store.fetchPendingInvites()

      expect(store.totalMemberSlots).toBe(50)
      expect(store.isInviteLimitReached).toBe(true)
    })
  })
})
