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
    isOriginalOwner: false,
    ...overrides
  }
}

function createInvite(overrides: Partial<PendingInvite> = {}): PendingInvite {
  return {
    id: 'invite-1',
    email: 'invitee@example.com',
    inviteDate: new Date('2025-03-01'),
    expiryDate: new Date('2025-04-01'),
    ...overrides
  }
}

describe('sortMembers', () => {
  it('places owners before members when sorting descending', () => {
    const owner = createMember({ id: 'o', role: 'owner', name: 'Owner' })
    const member = createMember({ id: 'm', role: 'member', name: 'Member' })
    const result = sortMembers([member, owner], null, 'desc')
    expect(result[0].id).toBe('o')
    expect(result[1].id).toBe('m')
  })

  it('places members before owners when sorting ascending', () => {
    const owner = createMember({ id: 'o', role: 'owner', name: 'Owner' })
    const member = createMember({ id: 'm', role: 'member', name: 'Member' })
    const result = sortMembers([member, owner], null, 'asc')
    expect(result[0].id).toBe('m')
    expect(result[1].id).toBe('o')
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

  it('pins the original owner first regardless of sort direction', () => {
    const creator = createMember({
      id: 'creator',
      role: 'owner',
      email: 'creator@test.com',
      joinDate: new Date('2025-01-01')
    })
    const promoted = createMember({
      id: 'promoted',
      role: 'owner',
      email: 'me@test.com',
      joinDate: new Date('2025-02-01')
    })
    const member = createMember({
      id: 'm',
      role: 'member',
      email: 'other@test.com',
      joinDate: new Date('2025-03-01')
    })

    const desc = sortMembers(
      [member, promoted, creator],
      'me@test.com',
      'desc',
      'creator'
    )
    expect(desc.map((m) => m.id)).toEqual(['creator', 'promoted', 'm'])

    const asc = sortMembers(
      [member, promoted, creator],
      'me@test.com',
      'asc',
      'creator'
    )
    expect(asc[0].id).toBe('creator')
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

  it('falls back to inviteDate when sortField is role', () => {
    const early = createInvite({
      id: 'e',
      inviteDate: new Date('2025-01-01')
    })
    const late = createInvite({
      id: 'l',
      inviteDate: new Date('2025-06-01')
    })
    const result = sortPendingInvites([early, late], 'role', 'desc')
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
const mockResendInvite = vi.fn()
const mockShowRemoveMemberDialog = vi.fn()
const mockShowRevokeInviteDialog = vi.fn()
const mockShowChangeMemberRoleDialog = vi.fn()
const mockShowSubscriptionDialog = vi.fn()
const mockShowInviteMemberDialog = vi.fn()
const mockShowInviteMemberUpsellDialog = vi.fn()

const {
  mockActiveWorkspace,
  mockMembers,
  mockPendingInvites,
  mockOriginalOwnerId,
  mockMaxSeats,
  mockOccupiedSeats,
  mockPermissions,
  mockUiConfig,
  mockIsActiveSubscription,
  mockIsInitialized,
  mockIsTeamPlan,
  mockSubscriptionStatus,
  mockWorkspaceRole,
  mockSubscription
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockActiveWorkspace: ref<{ type: 'personal' | 'team' } | null>({
      type: 'personal'
    }),
    mockMembers: ref<WorkspaceMember[]>([]),
    mockPendingInvites: ref<PendingInvite[]>([]),
    mockOriginalOwnerId: ref<string | null>(null),
    mockMaxSeats: ref<number | null>(73),
    mockOccupiedSeats: ref<number | null>(0),
    mockPermissions: ref({
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canManageMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true,
      canTopUp: true
    }),
    mockUiConfig: ref({
      showMembersList: true,
      showPendingTab: true,
      showSearch: true,
      showRoleColumn: true,
      membersGridCols: 'grid-cols-[50%_40%_10%]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[50%_40%_10%]',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete' as 'delete' | null,
      workspaceMenuDisabledTooltip: null as string | null
    }),
    mockIsActiveSubscription: ref(true),
    mockIsInitialized: ref(true),
    mockIsTeamPlan: ref(true),
    mockSubscriptionStatus: ref<string | null>('active'),
    mockWorkspaceRole: ref<'owner' | 'member'>('owner'),
    mockSubscription: ref<{ tier: string; isCancelled?: boolean } | null>({
      tier: 'PRO',
      isCancelled: false
    })
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
    activeWorkspace: mockActiveWorkspace,
    members: mockMembers,
    pendingInvites: mockPendingInvites,
    originalOwnerId: mockOriginalOwnerId,
    resendInvite: mockResendInvite
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: mockPermissions,
    uiConfig: mockUiConfig,
    workspaceRole: mockWorkspaceRole
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userPhotoUrl: ref(null),
    userEmail: ref('owner@example.com'),
    userDisplayName: ref('Owner User')
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ show: mockShowSubscriptionDialog })
  })
)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: mockIsActiveSubscription,
    isInitialized: mockIsInitialized,
    isTeamPlan: mockIsTeamPlan,
    subscription: mockSubscription,
    subscriptionStatus: mockSubscriptionStatus,
    maxSeats: mockMaxSeats,
    occupiedSeats: mockOccupiedSeats,
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

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ show: vi.fn() })
  })
)

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showRemoveMemberDialog: mockShowRemoveMemberDialog,
    showRevokeInviteDialog: mockShowRevokeInviteDialog,
    showChangeMemberRoleDialog: mockShowChangeMemberRoleDialog,
    showInviteMemberDialog: mockShowInviteMemberDialog,
    showInviteMemberUpsellDialog: mockShowInviteMemberUpsellDialog
  })
}))

describe('useMembersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveWorkspace.value = { type: 'personal' }
    mockMembers.value = []
    mockPendingInvites.value = []
    mockOriginalOwnerId.value = null
    mockMaxSeats.value = 73
    mockOccupiedSeats.value = 0
    mockIsActiveSubscription.value = true
    mockIsInitialized.value = true
    mockIsTeamPlan.value = true
    mockSubscriptionStatus.value = 'active'
    mockWorkspaceRole.value = 'owner'
    mockSubscription.value = { tier: 'PRO', isCancelled: false }
    mockPermissions.value = {
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canManageMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true,
      canTopUp: true
    }
    mockUiConfig.value = {
      showMembersList: true,
      showPendingTab: true,
      showSearch: true,
      showRoleColumn: true,
      membersGridCols: 'grid-cols-[50%_40%_10%]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[50%_40%_10%]',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete',
      workspaceMenuDisabledTooltip: null
    }
  })

  // Lazy import so mocks are in place
  async function setup() {
    const { useMembersPanel } = await import('./useMembersPanel')
    return useMembersPanel()
  }

  describe('team plan detection', () => {
    it('is on the team plan when billing reports an active Team plan', async () => {
      const panel = await setup()
      expect(panel.hasTeamPlan.value).toBe(true)
      expect(panel.isOnTeamPlan.value).toBe(true)
    })

    it('is off the team plan when billing reports a personal plan', async () => {
      mockIsTeamPlan.value = false
      const panel = await setup()
      expect(panel.isOnTeamPlan.value).toBe(false)
    })

    it('is off the team plan when the subscription is inactive', async () => {
      mockIsActiveSubscription.value = false
      const panel = await setup()
      expect(panel.isOnTeamPlan.value).toBe(false)
    })

    it('enables Team member capabilities over personal workspace defaults', async () => {
      mockPermissions.value = {
        ...mockPermissions.value,
        canViewOtherMembers: false,
        canViewPendingInvites: false,
        canInviteMembers: false,
        canManageInvites: false,
        canManageMembers: false
      }
      mockUiConfig.value = {
        ...mockUiConfig.value,
        showMembersList: false,
        showPendingTab: false,
        showSearch: false,
        showRoleColumn: false,
        membersGridCols: 'grid-cols-1',
        headerGridCols: 'grid-cols-1'
      }

      const panel = await setup()

      expect(panel.permissions.value.canInviteMembers).toBe(true)
      expect(panel.permissions.value.canManageMembers).toBe(true)
      expect(panel.uiConfig.value.showMembersList).toBe(true)
      expect(panel.uiConfig.value.showPendingTab).toBe(true)
      expect(panel.uiConfig.value.showRoleColumn).toBe(true)
    })

    it('uses the single-user member layout for a personal plan', async () => {
      mockIsTeamPlan.value = false

      const panel = await setup()

      expect(panel.permissions.value.canInviteMembers).toBe(false)
      expect(panel.uiConfig.value.showMembersList).toBe(false)
      expect(panel.uiConfig.value.showPendingTab).toBe(false)
      expect(panel.uiConfig.value.membersGridCols).toBe('grid-cols-1')
    })

    it('uses the backend workspace override regardless of tier', async () => {
      mockSubscription.value = { tier: 'CREATOR', isCancelled: false }
      const panel = await setup()
      expect(panel.maxSeats.value).toBe(73)
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

  describe('handleResendInvite', () => {
    it('resends the invite and shows a success toast', async () => {
      mockResendInvite.mockResolvedValue(undefined)
      const panel = await setup()
      await panel.handleResendInvite(createInvite({ id: 'inv-1' }))
      expect(mockResendInvite).toHaveBeenCalledWith('inv-1')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'workspacePanel.toast.inviteResent'
        })
      )
    })

    it('shows error toast on failure', async () => {
      mockResendInvite.mockRejectedValue(new Error('fail'))
      const panel = await setup()
      await panel.handleResendInvite(createInvite({ id: 'inv-1' }))
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'workspacePanel.toast.inviteResendFailed'
        })
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

  describe('handleRemoveMember', () => {
    it('calls showRemoveMemberDialog', async () => {
      const panel = await setup()
      panel.handleRemoveMember(createMember({ id: 'mem-7' }))
      expect(mockShowRemoveMemberDialog).toHaveBeenCalledWith('mem-7')
    })
  })

  describe('handleChangeRole', () => {
    it('opens the change-role dialog when promoting a member', async () => {
      const panel = await setup()
      panel.handleChangeRole(
        createMember({ id: 'mem-7', name: 'Jane', role: 'member' }),
        'owner'
      )
      expect(mockShowChangeMemberRoleDialog).toHaveBeenCalledWith({
        memberId: 'mem-7',
        memberName: 'Jane',
        targetRole: 'owner'
      })
    })

    it('opens the change-role dialog when demoting an owner', async () => {
      const panel = await setup()
      panel.handleChangeRole(
        createMember({ id: 'own-2', name: 'Jane', role: 'owner' }),
        'member'
      )
      expect(mockShowChangeMemberRoleDialog).toHaveBeenCalledWith({
        memberId: 'own-2',
        memberName: 'Jane',
        targetRole: 'member'
      })
    })

    it('is a no-op when the member already has the target role', async () => {
      const panel = await setup()
      panel.handleChangeRole(createMember({ role: 'member' }), 'member')
      expect(mockShowChangeMemberRoleDialog).not.toHaveBeenCalled()
    })
  })

  describe('memberMenuItems', () => {
    it('builds a Change role submenu with the current role checked', async () => {
      const panel = await setup()
      const items = panel.memberMenuItems(createMember({ role: 'member' }))

      expect(items.map((i) => i.label)).toEqual([
        'workspacePanel.members.actions.changeRole',
        'workspacePanel.members.actions.removeMember'
      ])

      const roleItems = items[0].items ?? []
      expect(roleItems.map((i) => i.label)).toEqual([
        'workspaceSwitcher.roleOwner',
        'workspaceSwitcher.roleMember'
      ])
      expect(roleItems.map((i) => i.checked)).toEqual([false, true])
    })

    it('checks Owner for owner rows', async () => {
      const panel = await setup()
      const items = panel.memberMenuItems(createMember({ role: 'owner' }))
      const roleItems = items[0].items ?? []
      expect(roleItems.map((i) => i.checked)).toEqual([true, false])
    })

    it('routes submenu selection to the change-role dialog', async () => {
      const panel = await setup()
      const member = createMember({ id: 'mem-9', role: 'member' })
      const ownerItem = (panel.memberMenuItems(member)[0].items ?? [])[0]

      ownerItem.command?.({
        originalEvent: new Event('click'),
        item: ownerItem
      })

      expect(mockShowChangeMemberRoleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: 'mem-9', targetRole: 'owner' })
      )
    })

    it('routes Remove member to the remove dialog', async () => {
      const panel = await setup()
      const member = createMember({ id: 'mem-9' })
      const removeItem = panel.memberMenuItems(member)[1]

      removeItem.command?.({
        originalEvent: new Event('click'),
        item: removeItem
      })

      expect(mockShowRemoveMemberDialog).toHaveBeenCalledWith('mem-9')
    })
  })

  describe('isOriginalOwner', () => {
    it('protects the matching creator in a personal workspace', async () => {
      mockOriginalOwnerId.value = 'creator-1'
      const panel = await setup()
      expect(panel.isOriginalOwner(createMember({ id: 'creator-1' }))).toBe(
        true
      )
      expect(panel.isOriginalOwner(createMember({ id: 'other' }))).toBe(false)
    })

    it('treats an additional workspace creator as an ordinary owner', async () => {
      mockActiveWorkspace.value = { type: 'team' }
      mockOriginalOwnerId.value = 'creator-1'
      const panel = await setup()

      expect(panel.isOriginalOwner(createMember({ id: 'creator-1' }))).toBe(
        false
      )
    })
  })

  describe('single-member visibility gating', () => {
    it('hides search and view tabs when the owner is alone', async () => {
      mockMembers.value = [
        createMember({ role: 'owner', email: 'owner@example.com' })
      ]
      const panel = await setup()
      expect(panel.showSearch.value).toBe(false)
      expect(panel.showViewTabs.value).toBe(false)
    })

    it('shows search and view tabs with more than one member', async () => {
      mockMembers.value = [createMember(), createMember({ id: '2' })]
      const panel = await setup()
      expect(panel.showSearch.value).toBe(true)
      expect(panel.showViewTabs.value).toBe(true)
    })

    it('shows view tabs for a lone owner with pending invites', async () => {
      mockMembers.value = [
        createMember({ role: 'owner', email: 'owner@example.com' })
      ]
      mockPendingInvites.value = [createInvite()]
      const panel = await setup()
      expect(panel.showViewTabs.value).toBe(true)
      expect(panel.showSearch.value).toBe(false)
    })

    it('shows search for >1 member regardless of tier', async () => {
      mockSubscription.value = { tier: 'STANDARD', isCancelled: false }
      mockMembers.value = [createMember(), createMember({ id: '2' })]
      const panel = await setup()
      expect(panel.showSearch.value).toBe(true)
      expect(panel.showViewTabs.value).toBe(true)
    })

    it('hides Team member controls for a personal plan', async () => {
      mockIsTeamPlan.value = false
      mockMembers.value = [createMember(), createMember({ id: '2' })]
      const panel = await setup()
      expect(panel.showViewTabs.value).toBe(false)
      expect(panel.showSearch.value).toBe(false)
    })
  })

  describe('invite gating', () => {
    it('opens the invite dialog on an active team plan', async () => {
      const panel = await setup()
      panel.handleInviteMember()
      expect(mockShowInviteMemberDialog).toHaveBeenCalled()
      expect(mockShowInviteMemberUpsellDialog).not.toHaveBeenCalled()
    })

    it('opens the upsell dialog when not on a team plan', async () => {
      mockIsTeamPlan.value = false
      const panel = await setup()
      panel.handleInviteMember()
      expect(mockShowInviteMemberUpsellDialog).toHaveBeenCalled()
      expect(mockShowInviteMemberDialog).not.toHaveBeenCalled()
    })

    it('disables the invite button at the backend member limit', async () => {
      mockOccupiedSeats.value = 73
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(true)
      expect(panel.inviteTooltip.value).toBe(
        'workspacePanel.inviteLimitReached'
      )
      panel.handleInviteMember()
      expect(mockShowInviteMemberDialog).not.toHaveBeenCalled()
    })

    it('keeps the invite button enabled below the member cap', async () => {
      mockOccupiedSeats.value = 72
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(false)
      expect(panel.inviteTooltip.value).toBeNull()
    })

    it('fails closed without showing a limit tooltip while loading', async () => {
      mockMaxSeats.value = null
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(true)
      expect(panel.inviteTooltip.value).toBeNull()
    })

    it('fails closed while backend occupancy is unresolved', async () => {
      mockOccupiedSeats.value = null
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(true)
      expect(panel.inviteTooltip.value).toBeNull()
    })

    it('treats a zero backend limit as unlimited', async () => {
      mockMaxSeats.value = 0
      mockOccupiedSeats.value = 1000
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(false)
    })

    it('disables the invite button when not on a team plan', async () => {
      mockIsTeamPlan.value = false
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(true)
    })

    it('disables the invite button when the team plan is cancelled', async () => {
      mockSubscription.value = { tier: 'PRO', isCancelled: true }
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(true)
      panel.handleInviteMember()
      expect(mockShowInviteMemberDialog).not.toHaveBeenCalled()
    })

    it('enables invite for a Team-plan owner over personal defaults', async () => {
      mockPermissions.value = {
        ...mockPermissions.value,
        canInviteMembers: false
      }
      const panel = await setup()
      expect(panel.showInviteButton.value).toBe(true)
      expect(panel.isInviteDisabled.value).toBe(false)
    })

    it('hides the invite button for workspace members', async () => {
      mockWorkspaceRole.value = 'member'
      const panel = await setup()
      expect(panel.showInviteButton.value).toBe(false)
    })

    it('keeps invite disabled while billing is initializing', async () => {
      mockIsInitialized.value = false
      const panel = await setup()
      expect(panel.isInviteDisabled.value).toBe(true)
      panel.handleInviteMember()
      expect(mockShowInviteMemberDialog).not.toHaveBeenCalled()
      expect(mockShowInviteMemberUpsellDialog).not.toHaveBeenCalled()
    })
  })
})
