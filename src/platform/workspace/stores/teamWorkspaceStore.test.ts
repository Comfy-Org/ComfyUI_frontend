import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sortWorkspaces, useTeamWorkspaceStore } from './teamWorkspaceStore'

// Mock workspaceAuthStore
const mockWorkspaceAuthStore = vi.hoisted(() => ({
  currentWorkspace: null as {
    id: string
    name: string
    type: 'personal' | 'team'
    role: 'owner' | 'member'
  } | null,
  workspaceToken: null as string | null,
  isLoading: false,
  error: null as Error | null,
  isAuthenticated: false,
  init: vi.fn(),
  destroy: vi.fn(),
  initializeFromSession: vi.fn(),
  switchWorkspace: vi.fn(),
  refreshToken: vi.fn(),
  getWorkspaceAuthHeader: vi.fn(),
  clearWorkspaceContext: vi.fn()
}))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => mockWorkspaceAuthStore
}))

// Mock current user (drives the original-owner self-row match by email)
const mockCurrentUser = vi.hoisted(() => ({
  userEmail: { value: null as string | null }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ userEmail: mockCurrentUser.userEmail })
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
  updateMemberRole: vi.fn(),
  listInvites: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  acceptInvite: vi.fn(),
  accessBillingPortal: vi.fn()
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

// Mock localStorage
const mockLocalStorage = vi.hoisted(() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((_key: string): string | null => store[_key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key])
    })
  }
})

// Mock window.location.reload
const mockReload = vi.fn()
Object.defineProperty(window, 'location', {
  value: { reload: mockReload, origin: 'http://localhost' },
  writable: true
})

// Test data
const mockPersonalWorkspace = {
  id: 'ws-personal-123',
  name: 'Personal',
  type: 'personal' as const,
  role: 'owner' as const,
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
}

const mockTeamWorkspace = {
  id: 'ws-team-456',
  name: 'Team Alpha',
  type: 'team' as const,
  role: 'owner' as const,
  created_at: '2026-02-01T00:00:00Z',
  joined_at: '2026-02-01T00:00:00Z'
}

const mockMemberWorkspace = {
  id: 'ws-team-789',
  name: 'Team Beta',
  type: 'team' as const,
  role: 'member' as const,
  created_at: '2026-03-01T00:00:00Z',
  joined_at: '2026-03-01T00:00:00Z'
}

describe('useTeamWorkspaceStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', mockLocalStorage)
    sessionStorage.clear()
    mockCurrentUser.userEmail.value = null

    // Reset workspaceAuthStore mock state
    mockWorkspaceAuthStore.currentWorkspace = null
    mockWorkspaceAuthStore.workspaceToken = null
    mockWorkspaceAuthStore.isLoading = false
    mockWorkspaceAuthStore.error = null
    mockWorkspaceAuthStore.isAuthenticated = false
    mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(false)
    mockWorkspaceAuthStore.switchWorkspace.mockResolvedValue(undefined)

    // Default mock responses
    mockWorkspaceApi.list.mockResolvedValue({
      workspaces: [mockPersonalWorkspace, mockTeamWorkspace]
    })
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
      expect(mockWorkspaceAuthStore.switchWorkspace).toHaveBeenCalledWith(
        mockPersonalWorkspace.id
      )
    })

    it('restores workspace from session if valid', async () => {
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockTeamWorkspace.id)
      expect(mockWorkspaceAuthStore.switchWorkspace).not.toHaveBeenCalled()
    })

    it('falls back to localStorage if no session', async () => {
      mockLocalStorage.getItem.mockReturnValue(mockTeamWorkspace.id)

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockTeamWorkspace.id)
    })

    it('falls back to personal if stored workspace not in list', async () => {
      mockLocalStorage.getItem.mockReturnValue('non-existent-workspace')

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockPersonalWorkspace.id)
    })

    it('sets error state when workspaces fetch fails after retries', async () => {
      vi.useFakeTimers()
      mockWorkspaceApi.list.mockRejectedValue(new Error('Network error'))

      const store = useTeamWorkspaceStore()

      // Start initialization and catch rejections to prevent unhandled promise warning
      let initError: unknown = null
      const initPromise = store.initialize().catch((e: unknown) => {
        initError = e
      })

      // Fast-forward through all retry delays (1s, 2s, 4s)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      await initPromise

      expect(initError).toBeInstanceOf(Error)
      expect((initError as Error).message).toBe('Network error')
      expect(store.initState).toBe('error')
      expect(store.error).toBeInstanceOf(Error)
      // Should have been called 4 times (initial + 3 retries)
      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(4)

      vi.useRealTimers()
    })

    it('does not reinitialize if already initialized', async () => {
      const store = useTeamWorkspaceStore()

      await store.initialize()
      await store.initialize()

      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(1)
    })

    it('can initialize the next user after identity state is reset', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      store.resetForIdentityChange()

      expect(store.initState).toBe('uninitialized')
      expect(store.workspaces).toEqual([])
      expect(store.activeWorkspaceId).toBeNull()
      expect(store.error).toBeNull()
      expect(store.isFetchingWorkspaces).toBe(false)

      mockWorkspaceApi.list.mockResolvedValueOnce({
        workspaces: [mockMemberWorkspace]
      })
      await store.initialize()

      expect(store.initState).toBe('ready')
      expect(store.workspaces).toEqual([
        expect.objectContaining({ id: mockMemberWorkspace.id })
      ])
      expect(store.activeWorkspaceId).toBe(mockMemberWorkspace.id)
    })

    it('does not let a previous user initialization overwrite the next user', async () => {
      let resolveFirstList: (value: unknown) => void = () => {}
      mockWorkspaceApi.list
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveFirstList = resolve
          })
        )
        .mockResolvedValueOnce({ workspaces: [mockMemberWorkspace] })

      const store = useTeamWorkspaceStore()
      const firstInitialization = store.initialize()
      store.resetForIdentityChange()
      const secondInitialization = store.initialize()

      await secondInitialization
      resolveFirstList({ workspaces: [mockPersonalWorkspace] })
      await firstInitialization

      expect(store.initState).toBe('ready')
      expect(store.workspaces).toEqual([
        expect.objectContaining({ id: mockMemberWorkspace.id })
      ])
      expect(store.activeWorkspaceId).toBe(mockMemberWorkspace.id)
      expect(mockWorkspaceAuthStore.switchWorkspace).toHaveBeenCalledOnce()
      expect(mockWorkspaceAuthStore.switchWorkspace).toHaveBeenCalledWith(
        mockMemberWorkspace.id
      )
    })

    it('throws when no workspaces available', async () => {
      mockWorkspaceApi.list.mockResolvedValue({ workspaces: [] })

      const store = useTeamWorkspaceStore()

      await expect(store.initialize()).rejects.toThrow(
        'No workspaces available'
      )
      expect(store.initState).toBe('error')
    })

    it('continues initialization even if token exchange fails', async () => {
      mockWorkspaceAuthStore.switchWorkspace.mockRejectedValue(
        new Error('Token exchange failed')
      )

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.initState).toBe('ready')
      expect(store.activeWorkspaceId).toBe(mockPersonalWorkspace.id)
    })
  })

  describe('switchWorkspace', () => {
    it('does nothing if switching to current workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      const currentId = store.activeWorkspaceId
      await store.switchWorkspace(currentId!)

      expect(mockReload).not.toHaveBeenCalled()
    })

    it('clears context and reloads for valid workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.switchWorkspace(mockTeamWorkspace.id)

      expect(mockWorkspaceAuthStore.clearWorkspaceContext).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
    })

    it('sets isSwitching flag during operation', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.isSwitching).toBe(false)

      const switchPromise = store.switchWorkspace(mockTeamWorkspace.id)
      expect(store.isSwitching).toBe(true)

      await switchPromise
    })

    it('refreshes workspace list if target not found', async () => {
      const newWorkspace = {
        id: 'ws-new-999',
        name: 'New Workspace',
        type: 'team' as const,
        role: 'member' as const,
        created_at: '2026-04-01T00:00:00Z',
        joined_at: '2026-04-01T00:00:00Z'
      }

      mockWorkspaceApi.list
        .mockResolvedValueOnce({
          workspaces: [mockPersonalWorkspace, mockTeamWorkspace]
        })
        .mockResolvedValueOnce({
          workspaces: [mockPersonalWorkspace, mockTeamWorkspace, newWorkspace]
        })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.switchWorkspace(newWorkspace.id)

      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(2)
      expect(mockReload).toHaveBeenCalled()
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

  describe('refreshWorkspaces', () => {
    it('does not let a previous user refresh overwrite the next user', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      let resolveRefresh: (value: unknown) => void = () => {}
      mockWorkspaceApi.list.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRefresh = resolve
        })
      )
      const previousRefresh = store.refreshWorkspaces()

      store.resetForIdentityChange()
      mockWorkspaceApi.list.mockResolvedValueOnce({
        workspaces: [mockMemberWorkspace]
      })
      await store.initialize()

      resolveRefresh({ workspaces: [mockTeamWorkspace] })
      await previousRefresh

      expect(store.initState).toBe('ready')
      expect(store.workspaces).toEqual([
        expect.objectContaining({
          id: mockMemberWorkspace.id,
          role: mockMemberWorkspace.role
        })
      ])
      expect(store.activeWorkspaceId).toBe(mockMemberWorkspace.id)
      expect(store.isFetchingWorkspaces).toBe(false)
    })
  })

  describe('forgetRevokedActiveWorkspace', () => {
    it.for([
      { type: 'team', workspace: mockTeamWorkspace, reloads: 1 },
      { type: 'personal', workspace: mockPersonalWorkspace, reloads: 0 }
    ])(
      'reloads $reloads time(s) when the active $type workspace is revoked',
      async ({ workspace, reloads }) => {
        const store = useTeamWorkspaceStore()
        await store.initialize()
        store.activeWorkspaceId = workspace.id

        store.forgetRevokedActiveWorkspace(workspace.id)

        expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(reloads)
        expect(mockReload).toHaveBeenCalledTimes(reloads)
      }
    )

    it('is a no-op when the workspace is not the active one', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()
      store.activeWorkspaceId = mockTeamWorkspace.id

      store.forgetRevokedActiveWorkspace('some-other-workspace')

      expect(mockReload).not.toHaveBeenCalled()
    })
  })

  describe('createWorkspace', () => {
    it('creates workspace and triggers reload', async () => {
      const newWorkspace = {
        id: 'ws-new-created',
        name: 'Created Workspace',
        type: 'team' as const,
        role: 'owner' as const,
        created_at: '2026-05-01T00:00:00Z',
        joined_at: '2026-05-01T00:00:00Z'
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
      expect(mockWorkspaceAuthStore.clearWorkspaceContext).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
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
        role: 'owner',
        created_at: '2026-06-01T00:00:00Z',
        joined_at: '2026-06-01T00:00:00Z'
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

      expect(store.activeWorkspaceId).toBe(mockPersonalWorkspace.id)

      await store.deleteWorkspace(mockTeamWorkspace.id)

      expect(mockWorkspaceApi.delete).toHaveBeenCalledWith(mockTeamWorkspace.id)
      expect(store.workspaces).not.toContainEqual(
        expect.objectContaining({ id: mockTeamWorkspace.id })
      )
      expect(mockReload).not.toHaveBeenCalled()
    })

    it('deletes active workspace and reloads to personal', async () => {
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.activeWorkspaceId).toBe(mockTeamWorkspace.id)

      await store.deleteWorkspace()

      expect(mockWorkspaceApi.delete).toHaveBeenCalledWith(mockTeamWorkspace.id)
      expect(mockWorkspaceAuthStore.clearWorkspaceContext).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
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
        { name: 'Renamed Workspace' }
      )

      const updated = store.workspaces.find(
        (w) => w.id === mockTeamWorkspace.id
      )
      expect(updated?.name).toBe('Renamed Workspace')
    })
  })

  describe('leaveWorkspace', () => {
    it('leaves workspace and reloads to personal', async () => {
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockMemberWorkspace
      mockWorkspaceApi.list.mockResolvedValue({
        workspaces: [mockPersonalWorkspace, mockMemberWorkspace]
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.leaveWorkspace()

      expect(mockWorkspaceApi.leave).toHaveBeenCalled()
      expect(mockWorkspaceAuthStore.clearWorkspaceContext).toHaveBeenCalled()
      expect(mockReload).toHaveBeenCalled()
    })

    it('throws when trying to leave personal workspace', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      await expect(store.leaveWorkspace()).rejects.toThrow(
        'Cannot leave personal workspace'
      )
    })
  })

  describe('computed properties', () => {
    it('activeWorkspace returns correct workspace', async () => {
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

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
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

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

      expect(store.ownedWorkspacesCount).toBe(2)
    })

    it('canCreateWorkspace respects limit', async () => {
      const manyWorkspaces = Array.from({ length: 10 }, (_, i) => ({
        id: `ws-owned-${i}`,
        name: `Owned ${i}`,
        type: 'team' as const,
        role: 'owner' as const,
        created_at: `2026-${String(i + 1).padStart(2, '0')}-01T00:00:00Z`,
        joined_at: `2026-${String(i + 1).padStart(2, '0')}-01T00:00:00Z`
      }))

      mockWorkspaceApi.list.mockResolvedValue({
        workspaces: [mockPersonalWorkspace, ...manyWorkspaces]
      })

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.ownedWorkspacesCount).toBe(11)
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
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.fetchMembers()

      expect(result).toHaveLength(2)
      expect(store.members).toHaveLength(2)
      expect(store.members[0].name).toBe('User One')
    })

    it('fetchMembers supports a personal workspace with Team entitlement', async () => {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [],
        pagination: { offset: 0, limit: 50, total: 0 }
      })
      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.fetchMembers()

      expect(result).toEqual([])
      expect(mockWorkspaceApi.listMembers).toHaveBeenCalled()
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
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()

      expect(store.members).toHaveLength(2)

      await store.removeMember('user-1')

      expect(mockWorkspaceApi.removeMember).toHaveBeenCalledWith('user-1')
      expect(store.members).toHaveLength(1)
      expect(store.members[0].id).toBe('user-2')
    })

    it('changeMemberRole flips the role locally without trusting the response body', async () => {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [
          {
            id: 'user-1',
            name: 'User One',
            email: 'one@test.com',
            joined_at: '2024-01-01T00:00:00Z',
            role: 'owner',
            is_original_owner: true
          },
          {
            id: 'user-2',
            name: 'User Two',
            email: 'two@test.com',
            joined_at: '2024-01-02T00:00:00Z',
            role: 'member',
            is_original_owner: false
          }
        ],
        pagination: { offset: 0, limit: 50, total: 2 }
      })
      // A divergent body (renamed, re-flagged) the store must NOT apply: only
      // the role is merged onto the existing row.
      mockWorkspaceApi.updateMemberRole.mockResolvedValue({
        id: 'user-2',
        name: 'Renamed By Server',
        email: 'two@test.com',
        joined_at: '2099-01-02T00:00:00Z',
        role: 'owner',
        is_original_owner: true
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()

      await store.changeMemberRole('user-2', 'owner')

      expect(mockWorkspaceApi.updateMemberRole).toHaveBeenCalledWith(
        'user-2',
        'owner'
      )
      const updated = store.members.find((m) => m.id === 'user-2')
      expect(updated?.role).toBe('owner')
      expect(updated?.name).toBe('User Two')
      expect(updated?.isOriginalOwner).toBe(false)
    })

    it('changeMemberRole leaves the list untouched when the API rejects', async () => {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [
          {
            id: 'user-2',
            name: 'User Two',
            email: 'two@test.com',
            joined_at: '2024-01-02T00:00:00Z',
            role: 'member',
            is_original_owner: false
          }
        ],
        pagination: { offset: 0, limit: 50, total: 1 }
      })
      mockWorkspaceApi.updateMemberRole.mockRejectedValue(new Error('boom'))
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()

      await expect(store.changeMemberRole('user-2', 'owner')).rejects.toThrow()
      expect(store.members[0].role).toBe('member')
    })

    it('changeMemberRole refuses to change the flagged creator and never calls the API', async () => {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [
          {
            id: 'user-2',
            name: 'User Two',
            email: 'two@test.com',
            joined_at: '2024-01-01T00:00:00Z',
            role: 'member',
            is_original_owner: false
          },
          {
            id: 'creator',
            name: 'Creator',
            email: 'creator@test.com',
            joined_at: '2024-01-02T00:00:00Z',
            role: 'owner',
            is_original_owner: true
          }
        ],
        pagination: { offset: 0, limit: 50, total: 2 }
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()

      await expect(store.changeMemberRole('creator', 'member')).rejects.toThrow(
        "Cannot change the workspace creator's role"
      )
      expect(mockWorkspaceApi.updateMemberRole).not.toHaveBeenCalled()
      expect(store.members.find((m) => m.id === 'creator')?.role).toBe('owner')
    })

    it('originalOwnerId is the member flagged is_original_owner, even when not earliest-joined', async () => {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [
          {
            id: 'early-joiner',
            name: 'Early Joiner',
            email: 'early@test.com',
            joined_at: '2024-01-01T00:00:00Z',
            role: 'owner',
            is_original_owner: false
          },
          {
            id: 'creator',
            name: 'Creator',
            email: 'creator@test.com',
            joined_at: '2024-02-01T00:00:00Z',
            role: 'owner',
            is_original_owner: true
          }
        ],
        pagination: { offset: 0, limit: 50, total: 2 }
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.originalOwnerId).toBeNull()

      await store.fetchMembers()

      expect(store.originalOwnerId).toBe('creator')
    })

    it('originalOwnerId falls back to the earliest-joined member when no flag is present', async () => {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [
          {
            id: 'later-joiner',
            name: 'Later Joiner',
            email: 'later@test.com',
            joined_at: '2024-03-01T00:00:00Z',
            role: 'owner'
          },
          {
            id: 'founder',
            name: 'Founder',
            email: 'founder@test.com',
            joined_at: '2024-01-01T00:00:00Z',
            role: 'owner'
          }
        ],
        pagination: { offset: 0, limit: 50, total: 2 }
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()

      expect(store.originalOwnerId).toBe('founder')

      await expect(store.changeMemberRole('founder', 'member')).rejects.toThrow(
        "Cannot change the workspace creator's role"
      )
      expect(mockWorkspaceApi.updateMemberRole).not.toHaveBeenCalled()
    })

    it('originalOwnerId fallback skips a non-owner earliest joiner, keeping them changeable', async () => {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [
          {
            id: 'early-member',
            name: 'Early Member',
            email: 'early@test.com',
            joined_at: '2024-01-01T00:00:00Z',
            role: 'member'
          },
          {
            id: 'late-owner',
            name: 'Late Owner',
            email: 'late@test.com',
            joined_at: '2024-02-01T00:00:00Z',
            role: 'owner'
          }
        ],
        pagination: { offset: 0, limit: 50, total: 2 }
      })
      mockWorkspaceApi.updateMemberRole.mockResolvedValue({
        id: 'early-member',
        name: 'Early Member',
        email: 'early@test.com',
        joined_at: '2024-01-01T00:00:00Z',
        role: 'owner',
        is_original_owner: false
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()

      // The earliest joiner is a plain member, so the creator falls back to the
      // earliest owner instead of mis-pinning the member.
      expect(store.originalOwnerId).toBe('late-owner')

      await store.changeMemberRole('early-member', 'owner')
      expect(mockWorkspaceApi.updateMemberRole).toHaveBeenCalledWith(
        'early-member',
        'owner'
      )
    })
  })

  describe('ensureMembersLoaded', () => {
    const memberRow = {
      id: 'user-1',
      name: 'Owner',
      email: 'owner@test.com',
      joined_at: '2024-01-01T00:00:00Z'
    }

    function mockMembersResponse() {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [memberRow],
        pagination: { offset: 0, limit: 50, total: 1 }
      })
    }

    async function activateTeamWorkspace() {
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace
      const store = useTeamWorkspaceStore()
      await store.initialize()
      return store
    }

    it('loads members for a team workspace that is not yet loaded', async () => {
      mockMembersResponse()
      const store = await activateTeamWorkspace()

      await store.ensureMembersLoaded()

      expect(mockWorkspaceApi.listMembers).toHaveBeenCalledTimes(1)
      expect(store.members).toHaveLength(1)
    })

    it('does not load members again once loaded', async () => {
      mockMembersResponse()
      const store = await activateTeamWorkspace()

      await store.ensureMembersLoaded()
      await store.ensureMembersLoaded()

      expect(mockWorkspaceApi.listMembers).toHaveBeenCalledTimes(1)
    })

    it('dedupes concurrent calls into a single request', async () => {
      mockMembersResponse()
      const store = await activateTeamWorkspace()

      await Promise.all([
        store.ensureMembersLoaded(),
        store.ensureMembersLoaded()
      ])

      expect(mockWorkspaceApi.listMembers).toHaveBeenCalledTimes(1)
    })

    it('loads members for an entitled personal workspace', async () => {
      mockMembersResponse()
      const store = useTeamWorkspaceStore()
      await store.initialize()

      await store.ensureMembersLoaded()

      expect(mockWorkspaceApi.listMembers).toHaveBeenCalledTimes(1)
      expect(store.members).toHaveLength(1)
    })

    it('logs a failed request and retries on the next call', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      mockWorkspaceApi.listMembers.mockRejectedValueOnce(new Error('boom'))
      const store = await activateTeamWorkspace()

      await store.ensureMembersLoaded()

      expect(consoleError).toHaveBeenCalled()
      expect(store.members).toHaveLength(0)

      mockMembersResponse()
      await store.ensureMembersLoaded()

      expect(mockWorkspaceApi.listMembers).toHaveBeenCalledTimes(2)
      expect(store.members).toHaveLength(1)

      consoleError.mockRestore()
    })
  })

  describe('isCurrentUserOriginalOwner', () => {
    async function loadTeamWithMembers(
      members: Array<{
        id: string
        name: string
        email: string
        joined_at: string
        is_original_owner?: boolean
      }>
    ) {
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members,
        pagination: { offset: 0, limit: 50, total: members.length }
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()
      return store
    }

    const ownerSelf = {
      id: 'user-1',
      name: 'Owner',
      email: 'owner@test.com',
      joined_at: '2024-01-01T00:00:00Z',
      role: 'owner' as const,
      is_original_owner: true
    }
    const promotedSelf = { ...ownerSelf, is_original_owner: false }

    it('is true when the self-row is the original owner', async () => {
      mockCurrentUser.userEmail.value = 'owner@test.com'
      const store = await loadTeamWithMembers([ownerSelf])
      expect(store.isCurrentUserOriginalOwner).toBe(true)
    })

    it('matches the self-row by email case-insensitively', async () => {
      mockCurrentUser.userEmail.value = 'OWNER@TEST.COM'
      const store = await loadTeamWithMembers([ownerSelf])
      expect(store.isCurrentUserOriginalOwner).toBe(true)
    })

    it('is false when the self-row is a promoted (non-creator) owner', async () => {
      mockCurrentUser.userEmail.value = 'owner@test.com'
      const creator = {
        id: 'creator',
        name: 'Creator',
        email: 'creator@test.com',
        joined_at: '2023-01-01T00:00:00Z',
        role: 'owner' as const,
        is_original_owner: true
      }
      const store = await loadTeamWithMembers([creator, promotedSelf])
      expect(store.isCurrentUserOriginalOwner).toBe(false)
    })

    it('infers the earliest owner as the original owner when no member is flagged', async () => {
      mockCurrentUser.userEmail.value = 'owner@test.com'
      const { is_original_owner: _omitted, ...ownerWithoutFlag } = ownerSelf
      const store = await loadTeamWithMembers([ownerWithoutFlag])
      expect(store.isCurrentUserOriginalOwner).toBe(true)
    })

    it('is false when the self-row is a plain member', async () => {
      mockCurrentUser.userEmail.value = 'member@test.com'
      const plainMember = {
        id: 'plain-member',
        name: 'Plain Member',
        email: 'member@test.com',
        joined_at: '2023-01-01T00:00:00Z',
        role: 'member' as const
      }
      const store = await loadTeamWithMembers([ownerSelf, plainMember])
      expect(store.isCurrentUserOriginalOwner).toBe(false)
    })

    it('is false when no member row matches the current user', async () => {
      mockCurrentUser.userEmail.value = 'someone-else@test.com'
      const store = await loadTeamWithMembers([ownerSelf])
      expect(store.isCurrentUserOriginalOwner).toBe(false)
    })

    it('fails closed when members are not loaded', async () => {
      mockCurrentUser.userEmail.value = 'owner@test.com'
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.isCurrentUserOriginalOwner).toBe(false)
    })

    it('fails closed when the current user email is unknown', async () => {
      mockCurrentUser.userEmail.value = null
      const store = await loadTeamWithMembers([ownerSelf])
      expect(store.isCurrentUserOriginalOwner).toBe(false)
    })

    it('recomputes reactively when the self-row arrives after an empty read', async () => {
      mockCurrentUser.userEmail.value = 'owner@test.com'
      mockWorkspaceApi.listMembers.mockResolvedValue({
        members: [ownerSelf],
        pagination: { offset: 0, limit: 50, total: 1 }
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()

      expect(store.isCurrentUserOriginalOwner).toBe(false)

      await store.fetchMembers()

      expect(store.isCurrentUserOriginalOwner).toBe(true)
    })
  })

  describe('invite actions', () => {
    it('fetchPendingInvites supports a personal workspace with Team entitlement', async () => {
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: [] })
      const store = useTeamWorkspaceStore()
      await store.initialize()

      const result = await store.fetchPendingInvites()

      expect(result).toEqual([])
      expect(mockWorkspaceApi.listInvites).toHaveBeenCalled()
    })

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
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

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
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

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
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchPendingInvites()

      await store.revokeInvite('inv-1')

      expect(mockWorkspaceApi.revokeInvite).toHaveBeenCalledWith('inv-1')
      expect(store.pendingInvites).toHaveLength(1)
      expect(store.pendingInvites[0].id).toBe('inv-2')
    })

    it('resendInvite creates a fresh invite before revoking the old one', async () => {
      mockWorkspaceApi.listInvites.mockResolvedValue({
        invites: [
          {
            id: 'inv-1',
            email: 'one@test.com',
            token: 'token-1',
            invited_at: '2024-01-01T00:00:00Z',
            expires_at: '2024-01-08T00:00:00Z'
          }
        ]
      })
      mockWorkspaceApi.createInvite.mockResolvedValue({
        id: 'inv-2',
        email: 'one@test.com',
        token: 'token-2',
        invited_at: '2024-02-01T00:00:00Z',
        expires_at: '2024-02-08T00:00:00Z'
      })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchPendingInvites()

      const result = await store.resendInvite('inv-1')

      expect(mockWorkspaceApi.revokeInvite).toHaveBeenCalledWith('inv-1')
      expect(mockWorkspaceApi.createInvite).toHaveBeenCalledWith({
        email: 'one@test.com'
      })
      expect(
        mockWorkspaceApi.createInvite.mock.invocationCallOrder[0]
      ).toBeLessThan(mockWorkspaceApi.revokeInvite.mock.invocationCallOrder[0])
      expect(result.id).toBe('inv-2')
      expect(store.pendingInvites).toHaveLength(1)
      expect(store.pendingInvites[0].id).toBe('inv-2')
    })

    it('resendInvite keeps the original invite and rethrows when creation fails', async () => {
      mockWorkspaceApi.listInvites.mockResolvedValue({
        invites: [
          {
            id: 'inv-1',
            email: 'one@test.com',
            token: 'token-1',
            invited_at: '2024-01-01T00:00:00Z',
            expires_at: '2024-01-08T00:00:00Z'
          }
        ]
      })
      mockWorkspaceApi.createInvite.mockRejectedValue(
        new Error('create failed')
      )
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchPendingInvites()

      await expect(store.resendInvite('inv-1')).rejects.toThrow('create failed')

      expect(mockWorkspaceApi.revokeInvite).not.toHaveBeenCalled()
      expect(store.pendingInvites).toHaveLength(1)
      expect(store.pendingInvites[0].id).toBe('inv-1')
    })

    it('resendInvite resyncs invites and rethrows when revoking the old fails', async () => {
      const inviteOne = {
        id: 'inv-1',
        email: 'one@test.com',
        token: 'token-1',
        invited_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-08T00:00:00Z'
      }
      const inviteTwo = {
        id: 'inv-2',
        email: 'one@test.com',
        token: 'token-2',
        invited_at: '2024-02-01T00:00:00Z',
        expires_at: '2024-02-08T00:00:00Z'
      }
      mockWorkspaceApi.listInvites
        .mockResolvedValueOnce({ invites: [inviteOne] })
        .mockResolvedValue({ invites: [inviteOne, inviteTwo] })
      mockWorkspaceApi.createInvite.mockResolvedValue(inviteTwo)
      mockWorkspaceApi.revokeInvite.mockRejectedValue(
        new Error('revoke failed')
      )
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchPendingInvites()

      await expect(store.resendInvite('inv-1')).rejects.toThrow('revoke failed')

      expect(mockWorkspaceApi.listInvites).toHaveBeenCalledTimes(2)
      expect(store.pendingInvites.map((i) => i.id)).toEqual(['inv-1', 'inv-2'])
    })

    it('resendInvite rejects a concurrent resend for the same invite', async () => {
      const inviteOne = {
        id: 'inv-1',
        email: 'one@test.com',
        token: 'token-1',
        invited_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-08T00:00:00Z'
      }
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: [inviteOne] })
      mockWorkspaceApi.createInvite.mockResolvedValue({
        id: 'inv-2',
        email: 'one@test.com',
        token: 'token-2',
        invited_at: '2024-02-01T00:00:00Z',
        expires_at: '2024-02-08T00:00:00Z'
      })
      mockWorkspaceApi.revokeInvite.mockResolvedValue(undefined)
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchPendingInvites()

      const first = store.resendInvite('inv-1')
      await expect(store.resendInvite('inv-1')).rejects.toThrow(
        'already in progress'
      )
      await first

      expect(mockWorkspaceApi.createInvite).toHaveBeenCalledTimes(1)
    })

    it('resendInvite throws for an unknown invite id', async () => {
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()

      await expect(store.resendInvite('missing')).rejects.toThrow(
        'Invite not found'
      )
      expect(mockWorkspaceApi.revokeInvite).not.toHaveBeenCalled()
      expect(mockWorkspaceApi.createInvite).not.toHaveBeenCalled()
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
      expect(mockWorkspaceApi.list).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup', () => {
    it('destroy calls workspaceAuthStore.destroy', async () => {
      const store = useTeamWorkspaceStore()
      await store.initialize()

      store.destroy()

      expect(mockWorkspaceAuthStore.destroy).toHaveBeenCalled()
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
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()
      await store.fetchPendingInvites()

      expect(store.totalMemberSlots).toBe(3)
      expect(store.isInviteLimitReached).toBe(false)
    })

    it('isInviteLimitReached enforces the flat 30-member backend cap, independent of plan seats', async () => {
      const mockMembers = Array.from({ length: 28 }, (_, i) => ({
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
        pagination: { offset: 0, limit: 50, total: 28 }
      })
      mockWorkspaceApi.listInvites.mockResolvedValue({ invites: mockInvites })
      mockWorkspaceAuthStore.initializeFromSession.mockReturnValue(true)
      mockWorkspaceAuthStore.currentWorkspace = mockTeamWorkspace

      const store = useTeamWorkspaceStore()
      await store.initialize()
      await store.fetchMembers()
      await store.fetchPendingInvites()

      expect(store.totalMemberSlots).toBe(30)
      expect(store.isInviteLimitReached).toBe(true)
    })
  })
})

describe('sortWorkspaces', () => {
  it('places personal first, then sorts ascending by created_at for owners and joined_at for members', () => {
    const input = [
      {
        created_at: '2026-06-01T00:00:00Z',
        id: 'w-team-new-owner',
        joined_at: '2026-01-01T00:00:00Z',
        name: 'Newest Owner Team',
        role: 'owner' as const,
        type: 'team' as const
      },
      {
        created_at: '2026-12-01T00:00:00Z',
        id: 'w-personal',
        joined_at: '2026-12-01T00:00:00Z',
        name: 'Personal Workspace',
        role: 'owner' as const,
        type: 'personal' as const
      },
      {
        created_at: '2026-01-01T00:00:00Z',
        id: 'w-team-member',
        joined_at: '2026-04-01T00:00:00Z',
        name: 'Member Team',
        role: 'member' as const,
        type: 'team' as const
      },
      {
        created_at: '2026-02-01T00:00:00Z',
        id: 'w-team-old-owner',
        joined_at: '2026-09-01T00:00:00Z',
        name: 'Oldest Owner Team',
        role: 'owner' as const,
        type: 'team' as const
      }
    ]

    expect(sortWorkspaces(input).map((w) => w.id)).toEqual([
      'w-personal',
      'w-team-old-owner',
      'w-team-member',
      'w-team-new-owner'
    ])
  })
})
