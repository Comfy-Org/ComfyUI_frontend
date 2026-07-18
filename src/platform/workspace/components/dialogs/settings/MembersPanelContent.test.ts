import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Slots } from 'vue'
import { computed, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MembersPanelContent from './MembersPanelContent.vue'

import type {
  PendingInvite,
  WorkspaceMember
} from '../../../stores/teamWorkspaceStore'

const mockHandleResendInvite = vi.fn()
const mockHandleRevokeInvite = vi.fn()
const mockMemberMenuItems = vi.fn(() => [])
const mockShowTeamPlans = vi.fn()
const mockToggleSort = vi.fn()
const mockHandleInviteMember = vi.fn()

const {
  mockMembers,
  mockPendingInvites,
  mockOriginalOwnerId,
  mockFilteredMembers,
  mockFilteredPendingInvites,
  mockHasTeamPlan,
  mockIsPlanLoading,
  mockIsOnTeamPlan,
  mockHasMultipleMembers,
  mockShowSearch,
  mockShowViewTabs,
  mockShowInviteButton,
  mockIsInviteDisabled,
  mockActiveView,
  mockSearchQuery,
  mockPermissions,
  mockUiConfig
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockMembers: ref<WorkspaceMember[]>([]),
    mockPendingInvites: ref<PendingInvite[]>([]),
    mockOriginalOwnerId: ref<string | null>(null),
    mockHasMultipleMembers: ref(true),
    mockShowSearch: ref(true),
    mockShowViewTabs: ref(true),
    mockShowInviteButton: ref(true),
    mockIsInviteDisabled: ref(false),
    mockFilteredMembers: ref<WorkspaceMember[]>([]),
    mockFilteredPendingInvites: ref<PendingInvite[]>([]),
    mockHasTeamPlan: ref(true),
    mockIsPlanLoading: ref(false),
    mockIsOnTeamPlan: ref(true),
    mockActiveView: ref<'active' | 'pending'>('active'),
    mockSearchQuery: ref(''),
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
      workspaceMenuAction: 'delete' as 'leave' | 'delete' | null,
      workspaceMenuDisabledTooltip: null as string | null
    })
  }
})

vi.mock('@/platform/workspace/composables/useMembersPanel', () => ({
  useMembersPanel: () => ({
    searchQuery: mockSearchQuery,
    activeView: mockActiveView,
    maxSeats: computed(() => 20),
    hasTeamPlan: mockHasTeamPlan,
    isPlanLoading: mockIsPlanLoading,
    isOnTeamPlan: mockIsOnTeamPlan,
    hasLapsedTeamPlan: computed(() => false),
    hasMultipleMembers: mockHasMultipleMembers,
    showSearch: mockShowSearch,
    showViewTabs: mockShowViewTabs,
    showInviteButton: mockShowInviteButton,
    isInviteDisabled: mockIsInviteDisabled,
    inviteTooltip: computed(() => null),
    handleInviteMember: mockHandleInviteMember,
    personalWorkspaceMember: computed(() => ({
      id: 'self',
      name: 'Owner User',
      email: 'owner@example.com',
      role: 'owner' as const,
      joinDate: new Date(0),
      isOriginalOwner: true
    })),
    filteredMembers: mockFilteredMembers,
    filteredPendingInvites: mockFilteredPendingInvites,
    memberMenuItems: mockMemberMenuItems,
    memberMenus: computed(
      () =>
        new Map(
          mockFilteredMembers.value.map((m) => [m.id, mockMemberMenuItems()])
        )
    ),
    members: mockMembers,
    pendingInvites: mockPendingInvites,
    permissions: mockPermissions,
    uiConfig: mockUiConfig,
    userPhotoUrl: ref(null),
    isCurrentUser: (m: WorkspaceMember) =>
      m.email.toLowerCase() === 'owner@example.com',
    isOriginalOwner: (m: WorkspaceMember) => m.id === mockOriginalOwnerId.value,
    toggleSort: mockToggleSort,
    showTeamPlans: mockShowTeamPlans,
    handleResendInvite: mockHandleResendInvite,
    handleRevokeInvite: mockHandleRevokeInvite,
    handleRemoveMember: vi.fn(),
    handleChangeRole: vi.fn()
  })
}))

vi.mock('@/components/button/MoreButton.vue', () => ({
  default: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.({ close: () => {} }))
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

function renderComponent() {
  return render(MembersPanelContent, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        SearchInput: SearchInputStub,
        UserAvatar: true,
        WorkspaceMenuButton: true
      },
      directives: { tooltip: () => {} }
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

describe('MembersPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMemberMenuItems.mockReturnValue([])
    mockMembers.value = []
    mockPendingInvites.value = []
    mockOriginalOwnerId.value = null
    mockFilteredMembers.value = []
    mockFilteredPendingInvites.value = []
    mockHasTeamPlan.value = true
    mockIsPlanLoading.value = false
    mockIsOnTeamPlan.value = true
    mockHasMultipleMembers.value = true
    mockShowSearch.value = true
    mockShowViewTabs.value = true
    mockShowInviteButton.value = true
    mockIsInviteDisabled.value = false
    mockActiveView.value = 'active'
    mockSearchQuery.value = ''
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

  describe('personal plan', () => {
    beforeEach(() => {
      mockHasTeamPlan.value = false
      mockIsOnTeamPlan.value = false
      mockHasMultipleMembers.value = false
      mockShowSearch.value = false
      mockShowViewTabs.value = false
      mockIsInviteDisabled.value = true
      mockUiConfig.value.showMembersList = false
      mockUiConfig.value.showSearch = false
      mockUiConfig.value.showPendingTab = false
    })

    it('shows the upsell banner below the members card', () => {
      renderComponent()
      expect(
        screen.getByText('workspacePanel.members.upsellBanner')
      ).toBeTruthy()
    })

    it('opens team plans on upgrade click', async () => {
      renderComponent()
      await userEvent.click(
        screen.getByRole('button', {
          name: /workspacePanel\.members\.upgradeToTeam/
        })
      )
      expect(mockShowTeamPlans).toHaveBeenCalled()
    })

    it('does not show search input', () => {
      renderComponent()
      expect(screen.queryByRole('textbox')).toBeNull()
    })
  })

  describe('Team plan member list', () => {
    it('shows the Role column header and member roles', () => {
      mockFilteredMembers.value = [
        createMember({ role: 'owner', email: 'boss@test.com' }),
        createMember({ id: '2', role: 'member', email: 'peer@test.com' })
      ]
      renderComponent()
      expect(
        screen.getByText('workspacePanel.members.columns.role')
      ).toBeTruthy()
      expect(screen.getByText('workspaceSwitcher.roleOwner')).toBeTruthy()
      expect(screen.getByText('workspaceSwitcher.roleMember')).toBeTruthy()
    })

    it('renders filtered members', () => {
      mockFilteredMembers.value = [
        createMember({ name: 'Alice', email: 'alice@test.com' }),
        createMember({
          id: '2',
          name: 'Bob',
          email: 'bob@test.com'
        })
      ]
      renderComponent()
      expect(screen.getByText('Alice')).toBeTruthy()
      expect(screen.getByText('Bob')).toBeTruthy()
      expect(
        screen.queryByText('workspacePanel.members.upsellBanner')
      ).toBeNull()
    })

    it('shows more options button for non-current members', () => {
      mockFilteredMembers.value = [
        createMember({ name: 'Other', email: 'other@test.com' })
      ]
      renderComponent()
      expect(
        screen.queryAllByRole('button', { name: 'g.moreOptions' })
      ).toHaveLength(1)
    })

    it('does not show more options for current user', () => {
      mockFilteredMembers.value = [
        createMember({ name: 'Owner User', email: 'owner@example.com' })
      ]
      renderComponent()
      expect(
        screen.queryAllByRole('button', { name: 'g.moreOptions' })
      ).toHaveLength(0)
    })

    it('does not show more options on the original owner row', () => {
      mockOriginalOwnerId.value = 'creator-1'
      mockFilteredMembers.value = [
        createMember({
          id: 'creator-1',
          name: 'Creator',
          email: 'creator@test.com',
          role: 'owner'
        }),
        createMember({ id: '2', name: 'Other', email: 'other@test.com' })
      ]
      renderComponent()

      const creatorRow = screen.getByTestId('member-row-creator-1')
      const otherRow = screen.getByTestId('member-row-2')
      expect(
        within(creatorRow).queryByRole('button', { name: 'g.moreOptions' })
      ).toBeNull()
      expect(
        within(otherRow).getByRole('button', { name: 'g.moreOptions' })
      ).toBeInTheDocument()
    })
  })

  describe('pending invites tab', () => {
    it('shows pending tab button when configured', () => {
      mockPendingInvites.value = [createInvite()]
      renderComponent()
      expect(
        screen.getByText(/workspacePanel\.members\.tabs\.pendingCount/)
      ).toBeTruthy()
    })

    it('triggers handleRevokeInvite from the row menu cancel item', async () => {
      mockActiveView.value = 'pending'
      mockFilteredPendingInvites.value = [createInvite({ id: 'inv-42' })]
      renderComponent()
      await userEvent.click(
        screen.getByRole('button', {
          name: 'workspacePanel.members.actions.cancelInvite'
        })
      )
      expect(mockHandleRevokeInvite).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'inv-42' })
      )
    })

    it('triggers handleResendInvite from the row menu resend item', async () => {
      mockActiveView.value = 'pending'
      mockFilteredPendingInvites.value = [createInvite({ id: 'inv-42' })]
      renderComponent()
      await userEvent.click(
        screen.getByRole('button', {
          name: 'workspacePanel.members.actions.resendInvite'
        })
      )
      expect(mockHandleResendInvite).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'inv-42' })
      )
    })
  })

  describe('member role', () => {
    beforeEach(() => {
      mockPermissions.value = {
        canViewOtherMembers: true,
        canViewPendingInvites: false,
        canInviteMembers: false,
        canManageInvites: false,
        canManageMembers: false,
        canLeaveWorkspace: true,
        canAccessWorkspaceMenu: true,
        canManageSubscription: false,
        canTopUp: false
      }
      mockUiConfig.value.showPendingTab = false
    })

    it('hides the pending tab button', () => {
      mockPendingInvites.value = [createInvite()]
      renderComponent()
      expect(
        screen.queryByText(/workspacePanel\.members\.tabs\.pendingCount/)
      ).toBeNull()
    })

    it('does not show the pending invites header', () => {
      mockActiveView.value = 'pending'
      mockPendingInvites.value = [createInvite()]
      renderComponent()
      expect(
        screen.queryByText(/workspacePanel\.members\.pendingInvitesCount/)
      ).toBeNull()
    })

    it('shows no action menus on member rows', () => {
      mockFilteredMembers.value = [
        createMember({ name: 'Other', email: 'other@test.com' })
      ]
      renderComponent()
      expect(
        screen.queryAllByRole('button', { name: 'g.moreOptions' })
      ).toHaveLength(0)
    })
  })

  describe('not on team plan', () => {
    beforeEach(() => {
      mockHasTeamPlan.value = false
      mockIsOnTeamPlan.value = false
      mockShowSearch.value = false
      mockShowViewTabs.value = false
    })

    it('shows upsell banner', () => {
      renderComponent()
      expect(
        screen.getByText('workspacePanel.members.upsellBanner')
      ).toBeTruthy()
    })

    it('hides the upsell banner when on a team plan', () => {
      mockHasTeamPlan.value = true
      mockIsOnTeamPlan.value = true
      renderComponent()
      expect(
        screen.queryByText('workspacePanel.members.upsellBanner')
      ).toBeNull()
    })

    it('opens subscription dialog on upgrade click', async () => {
      renderComponent()
      const upgradeBtn = screen.getByRole('button', {
        name: /workspacePanel\.members\.upgradeToTeam/
      })
      await userEvent.click(upgradeBtn)
      expect(mockShowTeamPlans).toHaveBeenCalled()
    })

    it('hides search input', () => {
      renderComponent()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('hides the contact us footer', () => {
      renderComponent()
      expect(screen.queryByText('workspacePanel.members.contactUs')).toBeNull()
    })

    it('does not show an upgrade banner while plan state is loading', () => {
      mockIsPlanLoading.value = true
      renderComponent()
      expect(
        screen.queryByText('workspacePanel.members.upsellBanner')
      ).toBeNull()
    })
  })

  describe('contact us footer', () => {
    it('opens discord in a new tab on a Team plan', async () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
      renderComponent()
      expect(
        screen.getByText('workspacePanel.members.needMoreMembers')
      ).toBeTruthy()
      await userEvent.click(
        screen.getByText('workspacePanel.members.contactUs')
      )
      expect(openSpy).toHaveBeenCalledWith(
        'https://discord.com/invite/comfyorg',
        '_blank',
        'noopener,noreferrer'
      )
      openSpy.mockRestore()
    })

    it('is shown whenever the active plan is Team', () => {
      renderComponent()
      expect(screen.getByText('workspacePanel.members.contactUs')).toBeTruthy()
    })
  })

  describe('member count display', () => {
    it('shows member count header for team workspace', () => {
      mockFilteredMembers.value = [
        createMember({ id: '1' }),
        createMember({ id: '2' })
      ]
      mockMembers.value = mockFilteredMembers.value
      renderComponent()
      expect(
        screen.getByText(/workspacePanel\.members\.membersCount/)
      ).toBeTruthy()
    })
  })

  describe('card header actions', () => {
    it('invokes the invite flow from the header invite button', async () => {
      renderComponent()
      await userEvent.click(
        screen.getByRole('button', { name: 'workspacePanel.inviteMember' })
      )
      expect(mockHandleInviteMember).toHaveBeenCalled()
    })

    it('hides the invite button without invite access', () => {
      mockShowInviteButton.value = false
      renderComponent()
      expect(
        screen.queryByRole('button', { name: 'workspacePanel.inviteMember' })
      ).toBeNull()
    })

    it('disables the invite button when gated', () => {
      mockIsInviteDisabled.value = true
      renderComponent()
      const button = screen.getByRole('button', {
        name: 'workspacePanel.inviteMember'
      })
      expect((button as HTMLButtonElement).disabled).toBe(true)
    })

    it('hides the view tabs for a lone owner', () => {
      mockShowViewTabs.value = false
      renderComponent()
      expect(
        screen.queryByText('workspacePanel.members.tabs.active')
      ).toBeNull()
      expect(
        screen.queryByText('workspacePanel.members.columns.role')
      ).toBeNull()
    })
  })
})
