import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type {
  PendingInvite,
  WorkspaceMember
} from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  filterBySearch,
  sortMembers,
  sortPendingInvites
} from './useMembersPanel'

function createMember(
  overrides: Partial<WorkspaceMember> = {}
): WorkspaceMember {
  return {
    id: 'member-1',
    name: 'Member One',
    email: 'member1@example.com',
    joinDate: new Date('2025-01-15'),
    role: 'member',
    ...overrides
  }
}

function createInvite(overrides: Partial<PendingInvite> = {}): PendingInvite {
  return {
    id: 'invite-1',
    email: 'invitee@example.com',
    token: 'token-abc',
    inviteDate: new Date('2025-03-01'),
    expiryDate: new Date('2025-04-01'),
    ...overrides
  }
}

describe('sortMembers', () => {
  it('places owners before members', () => {
    const owner = createMember({ id: 'o', role: 'owner', name: 'Owner' })
    const member = createMember({ id: 'm', role: 'member', name: 'Member' })
    const result = sortMembers([member, owner], null, 'desc')
    expect(result[0].id).toBe('o')
    expect(result[1].id).toBe('m')
  })

  it('places current user after owners but before others', () => {
    const owner = createMember({
      id: 'o',
      role: 'owner',
      email: 'boss@test.com',
      joinDate: new Date('2025-03-01')
    })
    const current = createMember({
      id: 'me',
      role: 'member',
      email: 'me@test.com',
      joinDate: new Date('2025-02-01')
    })
    const other = createMember({
      id: 'other',
      role: 'member',
      email: 'other@test.com',
      joinDate: new Date('2025-01-01')
    })

    const result = sortMembers([other, current, owner], 'me@test.com', 'desc')
    expect(result.map((m) => m.id)).toEqual(['o', 'me', 'other'])
  })

  it('sorts remaining members by joinDate descending', () => {
    const early = createMember({
      id: 'early',
      joinDate: new Date('2025-01-01')
    })
    const late = createMember({
      id: 'late',
      joinDate: new Date('2025-06-01')
    })
    const result = sortMembers([early, late], null, 'desc')
    expect(result[0].id).toBe('late')
    expect(result[1].id).toBe('early')
  })

  it('sorts remaining members by joinDate ascending', () => {
    const early = createMember({
      id: 'early',
      joinDate: new Date('2025-01-01')
    })
    const late = createMember({
      id: 'late',
      joinDate: new Date('2025-06-01')
    })
    const result = sortMembers([early, late], null, 'asc')
    expect(result[0].id).toBe('early')
    expect(result[1].id).toBe('late')
  })

  it('does not mutate the input array', () => {
    const members = [
      createMember({ id: 'b', joinDate: new Date('2025-06-01') }),
      createMember({ id: 'a', joinDate: new Date('2025-01-01') })
    ]
    const original = [...members]
    sortMembers(members, null, 'desc')
    expect(members).toEqual(original)
  })
})

describe('filterBySearch', () => {
  const alice = createMember({
    id: '1',
    name: 'Alice',
    email: 'alice@example.com'
  })
  const bob = createMember({
    id: '2',
    name: 'Bob',
    email: 'bob@example.com'
  })

  it('returns all items when query is empty', () => {
    expect(filterBySearch([alice, bob], '')).toEqual([alice, bob])
  })

  it('filters by name (case-insensitive)', () => {
    const result = filterBySearch([alice, bob], 'alice')
    expect(result).toEqual([alice])
  })

  it('filters by email', () => {
    const result = filterBySearch([alice, bob], 'bob@')
    expect(result).toEqual([bob])
  })

  it('filters pending invites by email only', () => {
    const inv1 = createInvite({ id: 'i1', email: 'alice@test.com' })
    const inv2 = createInvite({ id: 'i2', email: 'bob@test.com' })
    const result = filterBySearch([inv1, inv2], 'alice')
    expect(result).toEqual([inv1])
  })
})

describe('sortPendingInvites', () => {
  it('sorts by inviteDate descending by default', () => {
    const early = createInvite({
      id: 'e',
      inviteDate: new Date('2025-01-01')
    })
    const late = createInvite({
      id: 'l',
      inviteDate: new Date('2025-06-01')
    })
    const result = sortPendingInvites([early, late], 'inviteDate', 'desc')
    expect(result[0].id).toBe('l')
    expect(result[1].id).toBe('e')
  })

  it('sorts by expiryDate ascending', () => {
    const early = createInvite({
      id: 'e',
      expiryDate: new Date('2025-01-01')
    })
    const late = createInvite({
      id: 'l',
      expiryDate: new Date('2025-06-01')
    })
    const result = sortPendingInvites([early, late], 'expiryDate', 'asc')
    expect(result[0].id).toBe('e')
    expect(result[1].id).toBe('l')
  })

  it('falls back to inviteDate when sortField is joinDate', () => {
    const early = createInvite({
      id: 'e',
      inviteDate: new Date('2025-01-01')
    })
    const late = createInvite({
      id: 'l',
      inviteDate: new Date('2025-06-01')
    })
    const result = sortPendingInvites([early, late], 'joinDate', 'desc')
    expect(result[0].id).toBe('l')
  })

  it('does not mutate the input array', () => {
    const invites = [
      createInvite({
        id: 'b',
        inviteDate: new Date('2025-06-01')
      }),
      createInvite({
        id: 'a',
        inviteDate: new Date('2025-01-01')
      })
    ]
    const original = [...invites]
    sortPendingInvites(invites, 'inviteDate', 'desc')
    expect(invites).toEqual(original)
  })
})

const mockToastAdd = vi.fn()
const mockCopyInviteLink = vi.fn()
const mockShowRemoveMemberDialog = vi.fn()
const mockShowRevokeInviteDialog = vi.fn()
const mockShowCreateWorkspaceDialog = vi.fn()
const mockShowSubscriptionDialog = vi.fn()

const {
  mockMembers,
  mockPendingInvites,
  mockIsInPersonalWorkspace,
  mockPermissions,
  mockUiConfig,
  mockIsActiveSubscription,
  mockSubscription
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockMembers: ref<WorkspaceMember[]>([]),
    mockPendingInvites: ref<PendingInvite[]>([]),
    mockIsInPersonalWorkspace: ref(false),
    mockPermissions: ref({
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canRemoveMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true,
      canTopUp: true
    }),
    mockUiConfig: ref({
      showMembersList: true,
      showPendingTab: true,
      showSearch: true,
      showDateColumn: true,
      showRoleBadge: true,
      membersGridCols: 'grid-cols-[50%_40%_10%]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[50%_40%_10%]',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete' as 'leave' | 'delete' | null,
      workspaceMenuDisabledTooltip: null as string | null
    }),
    mockIsActiveSubscription: ref(true),
    mockSubscription: ref<{ tier: string } | null>({ tier: 'PRO' })
  }
})

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    members: mockMembers,
    pendingInvites: mockPendingInvites,
    isInPersonalWorkspace: mockIsInPersonalWorkspace,
    copyInviteLink: mockCopyInviteLink
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: mockPermissions,
    uiConfig: mockUiConfig
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userPhotoUrl: ref(null),
    userEmail: ref('owner@example.com'),
    userDisplayName: ref('Owner User')
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: mockIsActiveSubscription,
    subscription: mockSubscription,
    showSubscriptionDialog: mockShowSubscriptionDialog,
    getMaxSeats: (tierKey: string) => {
      const seats: Record<string, number> = {
        free: 1,
        standard: 1,
        creator: 5,
        pro: 20
      }
      return seats[tierKey] ?? 1
    }
  })
}))

vi.mock('@/platform/cloud/subscription/constants/tierPricing', () => ({
  TIER_TO_KEY: {
    FREE: 'free',
    STANDARD: 'standard',
    CREATOR: 'creator',
    PRO: 'pro',
    FOUNDERS_EDITION: 'founder'
  }
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showRemoveMemberDialog: mockShowRemoveMemberDialog,
    showRevokeInviteDialog: mockShowRevokeInviteDialog,
    showCreateWorkspaceDialog: mockShowCreateWorkspaceDialog
  })
}))

describe('useMembersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMembers.value = []
    mockPendingInvites.value = []
    mockIsInPersonalWorkspace.value = false
    mockIsActiveSubscription.value = true
    mockSubscription.value = { tier: 'PRO' }
  })

  // Lazy import so mocks are in place
  async function setup() {
    const { useMembersPanel } = await import('./useMembersPanel')
    return useMembersPanel()
  }

  describe('isSingleSeatPlan', () => {
    it('is false for personal workspace', async () => {
      mockIsInPersonalWorkspace.value = true
      const panel = await setup()
      expect(panel.isSingleSeatPlan.value).toBe(false)
    })

    it('is true when no active subscription', async () => {
      mockIsActiveSubscription.value = false
      const panel = await setup()
      expect(panel.isSingleSeatPlan.value).toBe(true)
    })

    it('is true for standard tier (1 seat)', async () => {
      mockSubscription.value = { tier: 'STANDARD' }
      const panel = await setup()
      expect(panel.isSingleSeatPlan.value).toBe(true)
    })

    it('is false for pro tier (20 seats)', async () => {
      mockSubscription.value = { tier: 'PRO' }
      const panel = await setup()
      expect(panel.isSingleSeatPlan.value).toBe(false)
    })
  })

  describe('maxSeats', () => {
    it('returns 1 for personal workspace', async () => {
      mockIsInPersonalWorkspace.value = true
      const panel = await setup()
      expect(panel.maxSeats.value).toBe(1)
    })

    it('returns tier-appropriate seats', async () => {
      mockSubscription.value = { tier: 'CREATOR' }
      const panel = await setup()
      expect(panel.maxSeats.value).toBe(5)
    })

    it('returns 1 when no subscription', async () => {
      mockSubscription.value = null
      const panel = await setup()
      expect(panel.maxSeats.value).toBe(1)
    })
  })

  describe('personalWorkspaceMember', () => {
    it('uses current user info', async () => {
      const panel = await setup()
      expect(panel.personalWorkspaceMember.value).toMatchObject({
        id: 'self',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner'
      })
    })
  })

  describe('isCurrentUser', () => {
    it('matches by email (case-insensitive)', async () => {
      const panel = await setup()
      const member = createMember({ email: 'OWNER@EXAMPLE.COM' })
      expect(panel.isCurrentUser(member)).toBe(true)
    })

    it('returns false for other users', async () => {
      const panel = await setup()
      const member = createMember({ email: 'other@example.com' })
      expect(panel.isCurrentUser(member)).toBe(false)
    })
  })

  describe('filteredMembers', () => {
    it('filters and sorts members based on searchQuery', async () => {
      const alice = createMember({
        id: '1',
        name: 'Alice',
        email: 'alice@example.com'
      })
      const bob = createMember({
        id: '2',
        name: 'Bob',
        email: 'bob@example.com'
      })
      mockMembers.value = [alice, bob]
      const panel = await setup()

      panel.searchQuery.value = 'alice'
      expect(panel.filteredMembers.value).toHaveLength(1)
      expect(panel.filteredMembers.value[0].name).toBe('Alice')
    })
  })

  describe('toggleSort', () => {
    it('changes sortField and resets to desc', async () => {
      const panel = await setup()
      panel.toggleSort('expiryDate')
      expect(panel.sortField.value).toBe('expiryDate')
      expect(panel.sortDirection.value).toBe('desc')
    })

    it('toggles direction when same field', async () => {
      const panel = await setup()
      panel.toggleSort('inviteDate')
      expect(panel.sortDirection.value).toBe('asc')
      panel.toggleSort('inviteDate')
      expect(panel.sortDirection.value).toBe('desc')
    })
  })

  describe('handleCopyInviteLink', () => {
    it('shows success toast on success', async () => {
      mockCopyInviteLink.mockResolvedValue(undefined)
      const panel = await setup()
      await panel.handleCopyInviteLink(createInvite({ id: 'inv-1' }))
      expect(mockCopyInviteLink).toHaveBeenCalledWith('inv-1')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('shows error toast on failure', async () => {
      mockCopyInviteLink.mockRejectedValue(new Error('fail'))
      const panel = await setup()
      await panel.handleCopyInviteLink(createInvite({ id: 'inv-1' }))
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  describe('handleRevokeInvite', () => {
    it('calls showRevokeInviteDialog', async () => {
      const panel = await setup()
      panel.handleRevokeInvite(createInvite({ id: 'inv-42' }))
      expect(mockShowRevokeInviteDialog).toHaveBeenCalledWith('inv-42')
    })
  })

  describe('handleCreateWorkspace', () => {
    it('calls showCreateWorkspaceDialog', async () => {
      const panel = await setup()
      panel.handleCreateWorkspace()
      expect(mockShowCreateWorkspaceDialog).toHaveBeenCalled()
    })
  })

  describe('handleRemoveMember', () => {
    it('calls showRemoveMemberDialog', async () => {
      const panel = await setup()
      panel.handleRemoveMember(createMember({ id: 'mem-7' }))
      expect(mockShowRemoveMemberDialog).toHaveBeenCalledWith('mem-7')
    })
  })
})
