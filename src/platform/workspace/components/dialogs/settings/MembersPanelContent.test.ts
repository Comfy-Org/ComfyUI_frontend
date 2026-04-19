import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MembersPanelContent from './MembersPanelContent.vue'

import type {
  PendingInvite,
  WorkspaceMember
} from '../../../stores/teamWorkspaceStore'

const mockToastAdd = vi.fn()
const mockShowRemoveMemberDialog = vi.fn()
const mockShowRevokeInviteDialog = vi.fn()
const mockShowCreateWorkspaceDialog = vi.fn()
const mockCopyInviteLink = vi.fn()
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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const ButtonStub = {
  name: 'Button',
  template:
    '<button :disabled="disabled" :aria-label="ariaLabel" @click="$emit(\'click\', $event)"><slot /></button>',
  props: ['disabled', 'loading', 'variant', 'size', 'ariaLabel']
}

const SearchInputStub = {
  name: 'SearchInput',
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue', 'placeholder', 'size'],
  emits: ['update:modelValue']
}

const MenuStub = {
  name: 'Menu',
  template: '<div />',
  props: ['model', 'popup'],
  methods: {
    toggle() {}
  }
}

function renderComponent() {
  return render(MembersPanelContent, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        SearchInput: SearchInputStub,
        UserAvatar: true,
        Menu: MenuStub
      },
      directives: {
        tooltip: () => {}
      }
    }
  })
}

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

function setOwnerTeamWorkspace(members: WorkspaceMember[] = []) {
  mockIsInPersonalWorkspace.value = false
  mockPermissions.value = {
    canViewOtherMembers: true,
    canViewPendingInvites: true,
    canInviteMembers: true,
    canManageInvites: true,
    canRemoveMembers: true,
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    canManageSubscription: true,
    canTopUp: true
  }
  mockUiConfig.value = {
    showMembersList: true,
    showPendingTab: true,
    showSearch: true,
    showDateColumn: true,
    showRoleBadge: true,
    membersGridCols: 'grid-cols-[50%_40%_10%]',
    pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
    headerGridCols: 'grid-cols-[50%_40%_10%]',
    showEditWorkspaceMenuItem: true,
    workspaceMenuAction: 'delete',
    workspaceMenuDisabledTooltip: null
  }
  mockIsActiveSubscription.value = true
  mockSubscription.value = { tier: 'PRO' }
  mockMembers.value = members
}

function setMemberTeamWorkspace(members: WorkspaceMember[] = []) {
  mockIsInPersonalWorkspace.value = false
  mockPermissions.value = {
    canViewOtherMembers: true,
    canViewPendingInvites: false,
    canInviteMembers: false,
    canManageInvites: false,
    canRemoveMembers: false,
    canLeaveWorkspace: true,
    canAccessWorkspaceMenu: true,
    canManageSubscription: false,
    canTopUp: false
  }
  mockUiConfig.value = {
    showMembersList: true,
    showPendingTab: false,
    showSearch: true,
    showDateColumn: true,
    showRoleBadge: true,
    membersGridCols: 'grid-cols-[1fr_auto]',
    pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
    headerGridCols: 'grid-cols-[1fr_auto]',
    showEditWorkspaceMenuItem: false,
    workspaceMenuAction: 'leave',
    workspaceMenuDisabledTooltip: null
  }
  mockIsActiveSubscription.value = true
  mockSubscription.value = { tier: 'PRO' }
  mockMembers.value = members
}

function setPersonalWorkspace() {
  mockIsInPersonalWorkspace.value = true
  mockPermissions.value = {
    canViewOtherMembers: false,
    canViewPendingInvites: false,
    canInviteMembers: false,
    canManageInvites: false,
    canRemoveMembers: false,
    canLeaveWorkspace: false,
    canAccessWorkspaceMenu: false,
    canManageSubscription: true,
    canTopUp: true
  }
  mockUiConfig.value = {
    showMembersList: false,
    showPendingTab: false,
    showSearch: false,
    showDateColumn: false,
    showRoleBadge: false,
    membersGridCols: 'grid-cols-1',
    pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
    headerGridCols: 'grid-cols-1',
    showEditWorkspaceMenuItem: false,
    workspaceMenuAction: null,
    workspaceMenuDisabledTooltip: null
  }
  mockMembers.value = []
  mockPendingInvites.value = []
}

function setSingleSeatPlan() {
  mockIsInPersonalWorkspace.value = false
  mockIsActiveSubscription.value = true
  mockSubscription.value = { tier: 'STANDARD' }
  mockMembers.value = []
}

function bodyText() {
  return document.body.textContent ?? ''
}

async function switchToPendingTab() {
  const pendingBtn = screen.getByRole('button', { name: /pendingCount/ })
  await userEvent.click(pendingBtn)
  await nextTick()
}

describe('MembersPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMembers.value = []
    mockPendingInvites.value = []
    mockIsInPersonalWorkspace.value = false
    mockIsActiveSubscription.value = true
    mockSubscription.value = { tier: 'PRO' }
    mockPermissions.value = {
      canViewOtherMembers: true,
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canRemoveMembers: true,
      canLeaveWorkspace: true,
      canAccessWorkspaceMenu: true,
      canManageSubscription: true,
      canTopUp: true
    }
    mockUiConfig.value = {
      showMembersList: true,
      showPendingTab: true,
      showSearch: true,
      showDateColumn: true,
      showRoleBadge: true,
      membersGridCols: 'grid-cols-[50%_40%_10%]',
      pendingGridCols: 'grid-cols-[50%_20%_20%_10%]',
      headerGridCols: 'grid-cols-[50%_40%_10%]',
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete',
      workspaceMenuDisabledTooltip: null
    }
  })

  describe('personal workspace', () => {
    it('shows current user with "(you)" label', () => {
      setPersonalWorkspace()
      renderComponent()
      expect(bodyText()).toContain('Owner User')
      expect(bodyText()).toContain('g.you')
    })

    it('shows personal workspace message and create workspace button', () => {
      setPersonalWorkspace()
      renderComponent()
      expect(bodyText()).toContain(
        'workspacePanel.members.personalWorkspaceMessage'
      )
      expect(bodyText()).toContain('workspacePanel.members.createNewWorkspace')
    })

    it('calls showCreateWorkspaceDialog when create workspace is clicked', async () => {
      setPersonalWorkspace()
      renderComponent()
      const createBtn = screen.getByText(
        'workspacePanel.members.createNewWorkspace'
      )
      await userEvent.click(createBtn)
      expect(mockShowCreateWorkspaceDialog).toHaveBeenCalled()
    })

    it('does not show search input', () => {
      setPersonalWorkspace()
      renderComponent()
      expect(screen.queryByRole('textbox')).toBeNull()
    })
  })

  describe('team workspace - owner view', () => {
    it('renders member list with names and emails', () => {
      const owner = createMember({
        id: 'owner-1',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner'
      })
      const member = createMember({
        id: 'member-2',
        name: 'Team Member',
        email: 'team@example.com'
      })
      setOwnerTeamWorkspace([owner, member])
      renderComponent()

      expect(bodyText()).toContain('Owner User')
      expect(bodyText()).toContain('Team Member')
      expect(bodyText()).toContain('owner@example.com')
      expect(bodyText()).toContain('team@example.com')
    })

    it('shows role badges', () => {
      const owner = createMember({
        id: 'owner-1',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner'
      })
      const member = createMember({
        id: 'member-2',
        name: 'Team Member',
        email: 'team@example.com',
        role: 'member'
      })
      setOwnerTeamWorkspace([owner, member])
      renderComponent()

      expect(bodyText()).toContain('workspaceSwitcher.roleOwner')
      expect(bodyText()).toContain('workspaceSwitcher.roleMember')
    })

    it('shows "(you)" label next to current user', () => {
      const currentUser = createMember({
        id: 'owner-1',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner'
      })
      setOwnerTeamWorkspace([currentUser])
      renderComponent()
      expect(bodyText()).toContain('g.you')
    })

    it('shows more options button for non-current members', () => {
      const owner = createMember({
        id: 'owner-1',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner'
      })
      const other = createMember({
        id: 'member-2',
        name: 'Other',
        email: 'other@example.com'
      })
      setOwnerTeamWorkspace([owner, other])
      renderComponent()

      const moreButtons = screen.queryAllByRole('button', {
        name: 'g.moreOptions'
      })
      expect(moreButtons).toHaveLength(1)
    })

    it('does not show more options button for self', () => {
      const currentUser = createMember({
        id: 'owner-1',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'owner'
      })
      setOwnerTeamWorkspace([currentUser])
      renderComponent()

      const moreButtons = screen.queryAllByRole('button', {
        name: 'g.moreOptions'
      })
      expect(moreButtons).toHaveLength(0)
    })

    it('shows pending tab button', () => {
      setOwnerTeamWorkspace([])
      mockPendingInvites.value = [createInvite()]
      renderComponent()
      expect(bodyText()).toContain('workspacePanel.members.tabs.pendingCount')
    })
  })

  describe('team workspace - member view', () => {
    it('does not show remove member buttons', () => {
      const members = [
        createMember({
          id: 'owner-1',
          name: 'The Owner',
          email: 'boss@example.com',
          role: 'owner'
        }),
        createMember({
          id: 'me',
          name: 'Owner User',
          email: 'owner@example.com',
          role: 'member'
        })
      ]
      setMemberTeamWorkspace(members)
      renderComponent()

      const moreButtons = screen.queryAllByRole('button', {
        name: 'g.moreOptions'
      })
      expect(moreButtons).toHaveLength(0)
    })

    it('does not show pending tab', () => {
      setMemberTeamWorkspace([])
      renderComponent()
      expect(bodyText()).not.toContain(
        'workspacePanel.members.tabs.pendingCount'
      )
    })
  })

  describe('member sorting', () => {
    it('sorts owners first, current user second, then rest', () => {
      const owner = createMember({
        id: 'owner-1',
        name: 'The Owner',
        email: 'boss@example.com',
        role: 'owner',
        joinDate: new Date('2025-03-01')
      })
      const currentUser = createMember({
        id: 'me',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'member',
        joinDate: new Date('2025-02-01')
      })
      const other = createMember({
        id: 'other',
        name: 'Other Member',
        email: 'other@example.com',
        role: 'member',
        joinDate: new Date('2025-01-01')
      })
      setOwnerTeamWorkspace([other, currentUser, owner])
      renderComponent()
      const text = bodyText()
      const ownerIdx = text.indexOf('The Owner')
      const currentIdx = text.indexOf('Owner User')
      const otherIdx = text.indexOf('Other Member')
      expect(ownerIdx).toBeLessThan(currentIdx)
      expect(currentIdx).toBeLessThan(otherIdx)
    })
  })

  describe('search filtering', () => {
    it('filters members by name', async () => {
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
      setOwnerTeamWorkspace([alice, bob])
      renderComponent()

      const searchInput = screen.getByRole('textbox')
      await fireEvent.update(searchInput, 'Alice')
      await nextTick()

      expect(bodyText()).toContain('Alice')
      expect(bodyText()).not.toContain('Bob')
    })

    it('filters members by email', async () => {
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
      setOwnerTeamWorkspace([alice, bob])
      renderComponent()

      const searchInput = screen.getByRole('textbox')
      await fireEvent.update(searchInput, 'bob@')
      await nextTick()

      expect(bodyText()).not.toContain('Alice')
      expect(bodyText()).toContain('Bob')
    })
  })

  describe('pending invites', () => {
    it('shows invite email and initial', async () => {
      setOwnerTeamWorkspace([])
      mockPendingInvites.value = [createInvite({ email: 'test@example.com' })]
      renderComponent()

      await switchToPendingTab()

      expect(bodyText()).toContain('test@example.com')
      expect(bodyText()).toContain('test')
      expect(bodyText()).toContain('T')
    })

    it('shows no invites message when empty', async () => {
      setOwnerTeamWorkspace([])
      mockPendingInvites.value = []
      renderComponent()
      await switchToPendingTab()

      expect(bodyText()).toContain('workspacePanel.members.noInvites')
    })

    it('triggers revoke invite dialog', async () => {
      setOwnerTeamWorkspace([])
      mockPendingInvites.value = [createInvite({ id: 'inv-42' })]
      renderComponent()
      await switchToPendingTab()

      const revokeBtn = screen.getByRole('button', {
        name: 'workspacePanel.members.actions.revokeInvite'
      })
      await userEvent.click(revokeBtn)

      expect(mockShowRevokeInviteDialog).toHaveBeenCalledWith('inv-42')
    })

    it('copies invite link and shows success toast', async () => {
      mockCopyInviteLink.mockResolvedValue(undefined)
      setOwnerTeamWorkspace([])
      mockPendingInvites.value = [createInvite({ id: 'inv-42' })]
      renderComponent()
      await switchToPendingTab()

      const copyBtn = screen.getByRole('button', {
        name: 'workspacePanel.members.actions.copyLink'
      })
      await userEvent.click(copyBtn)
      await nextTick()

      expect(mockCopyInviteLink).toHaveBeenCalledWith('inv-42')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('shows error toast when copy invite link fails', async () => {
      mockCopyInviteLink.mockRejectedValue(new Error('fail'))
      setOwnerTeamWorkspace([])
      mockPendingInvites.value = [createInvite({ id: 'inv-42' })]
      renderComponent()
      await switchToPendingTab()

      const copyBtn = screen.getByRole('button', {
        name: 'workspacePanel.members.actions.copyLink'
      })
      await userEvent.click(copyBtn)
      await nextTick()
      await new Promise((r) => setTimeout(r, 0))

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('filters pending invites by search query', async () => {
      setOwnerTeamWorkspace([])
      mockPendingInvites.value = [
        createInvite({ id: 'i1', email: 'alice@test.com' }),
        createInvite({ id: 'i2', email: 'bob@test.com' })
      ]
      renderComponent()
      await switchToPendingTab()

      const searchInput = screen.getByRole('textbox')
      await fireEvent.update(searchInput, 'alice')
      await nextTick()

      expect(bodyText()).toContain('alice@test.com')
      expect(bodyText()).not.toContain('bob@test.com')
    })
  })

  describe('single seat plan', () => {
    it('shows upsell banner', () => {
      setSingleSeatPlan()
      renderComponent()
      expect(bodyText()).toContain('workspacePanel.members.upsellBannerUpgrade')
      expect(bodyText()).toContain('workspacePanel.members.viewPlans')
    })

    it('shows subscribe message when no active subscription', () => {
      mockIsInPersonalWorkspace.value = false
      mockIsActiveSubscription.value = false
      mockSubscription.value = null
      mockMembers.value = []
      renderComponent()
      expect(bodyText()).toContain(
        'workspacePanel.members.upsellBannerSubscribe'
      )
    })

    it('opens subscription dialog when view plans is clicked', async () => {
      setSingleSeatPlan()
      renderComponent()
      const viewPlansBtn = screen.getByRole('button', {
        name: /workspacePanel\.members\.viewPlans/
      })
      await userEvent.click(viewPlansBtn)
      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
    })

    it('hides search input', () => {
      setSingleSeatPlan()
      mockUiConfig.value.showSearch = true
      renderComponent()
      expect(screen.queryByRole('textbox')).toBeNull()
    })
  })

  describe('member count display', () => {
    it('shows member count with maxSeats for team workspace', () => {
      setOwnerTeamWorkspace([
        createMember({ id: '1', email: 'a@b.com' }),
        createMember({ id: '2', email: 'c@d.com' })
      ])
      renderComponent()
      expect(bodyText()).toContain('workspacePanel.members.membersCount')
    })

    it('shows count of 1 for personal workspace', () => {
      setPersonalWorkspace()
      renderComponent()
      expect(bodyText()).toContain('workspacePanel.members.membersCount')
    })
  })
})
