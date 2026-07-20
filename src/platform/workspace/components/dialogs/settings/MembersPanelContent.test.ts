import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MembersPanelContent from './MembersPanelContent.vue'

import type {
  PendingInvite,
  WorkspaceMember
} from '../../../stores/teamWorkspaceStore'

const mockHandleResendInvite = vi.fn()
const mockHandleRevokeInvite = vi.fn()
const mockShowTeamPlans = vi.fn()
const mockToggleSort = vi.fn()
const mockHandleInviteMember = vi.fn()
const mockFetchBalance = vi.fn()

const {
  mockMembers,
  mockPendingInvites,
  mockOriginalOwnerId,
  mockFilteredMembers,
  mockFilteredPendingInvites,
  mockIsPersonalWorkspace,
  mockIsOnTeamPlan,
  mockShowSearch,
  mockShowViewTabs,
  mockShowInviteButton,
  mockIsInviteDisabled,
  mockActiveView,
  mockSearchQuery,
  mockSortField,
  mockSortDirection,
  mockPermissions,
  mockUiConfig
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockMembers: ref<WorkspaceMember[]>([]),
    mockPendingInvites: ref<PendingInvite[]>([]),
    mockOriginalOwnerId: ref<string | null>(null),
    mockShowSearch: ref(true),
    mockShowViewTabs: ref(true),
    mockShowInviteButton: ref(true),
    mockIsInviteDisabled: ref(false),
    mockFilteredMembers: ref<WorkspaceMember[]>([]),
    mockFilteredPendingInvites: ref<PendingInvite[]>([]),
    mockIsPersonalWorkspace: ref(false),
    mockIsOnTeamPlan: ref(true),
    mockActiveView: ref<'active' | 'pending'>('active'),
    mockSearchQuery: ref(''),
    mockSortField: ref('role'),
    mockSortDirection: ref('desc'),
    mockPermissions: ref({
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canManageMembers: true
    }),
    mockUiConfig: ref({
      showMembersList: true,
      showPendingTab: true,
      showSearch: true
    })
  }
})

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ isPaused: computed(() => false) })
}))

vi.mock('@/platform/workspace/composables/useMembersPanel', () => ({
  useMembersPanel: () => ({
    searchQuery: mockSearchQuery,
    activeView: mockActiveView,
    sortField: mockSortField,
    sortDirection: mockSortDirection,
    maxSeats: computed(() => 50),
    memberCount: computed(() => mockMembers.value.length),
    isOnTeamPlan: mockIsOnTeamPlan,
    hasLapsedTeamPlan: computed(() => false),
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
    memberMenus: computed(
      () =>
        new Map(
          mockFilteredMembers.value.map((member) => [
            member.id,
            member.email.toLowerCase() === 'owner@example.com' ||
            member.id === mockOriginalOwnerId.value
              ? []
              : [{ label: 'Action' }]
          ])
        )
    ),
    isPersonalWorkspace: mockIsPersonalWorkspace,
    pendingInvites: mockPendingInvites,
    permissions: mockPermissions,
    uiConfig: mockUiConfig,
    userPhotoUrl: ref(null),
    fetchBalance: mockFetchBalance,
    isCurrentUser: (m: WorkspaceMember) =>
      m.email.toLowerCase() === 'owner@example.com',
    isOriginalOwner: (m: WorkspaceMember) => m.id === mockOriginalOwnerId.value,
    toggleSort: mockToggleSort,
    showTeamPlans: mockShowTeamPlans,
    handleResendInvite: mockHandleResendInvite,
    handleRevokeInvite: mockHandleRevokeInvite
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

// Render the trigger slot (carries the g.moreOptions button) plus each entry as
// a flat button, so menu items are assertable without opening a real overlay.
const DropdownMenuStub = {
  name: 'DropdownMenu',
  props: ['entries', 'modal', 'contentClass'],
  template:
    '<div><slot name="button" /><button v-for="e in (entries || [])" :key="e.label" :aria-label="e.label" @click="e.command && e.command()">{{ e.label }}</button></div>'
}

function renderComponent() {
  return render(MembersPanelContent, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        SearchInput: SearchInputStub,
        DropdownMenu: DropdownMenuStub,
        UserAvatar: true,
        BillingStatusBanner: true
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
    mockMembers.value = []
    mockPendingInvites.value = []
    mockOriginalOwnerId.value = null
    mockFilteredMembers.value = []
    mockFilteredPendingInvites.value = []
    mockIsPersonalWorkspace.value = false
    mockIsOnTeamPlan.value = true
    mockShowSearch.value = true
    mockShowViewTabs.value = true
    mockShowInviteButton.value = true
    mockIsInviteDisabled.value = false
    mockActiveView.value = 'active'
    mockSearchQuery.value = ''
    mockPermissions.value = {
      canViewPendingInvites: true,
      canInviteMembers: true,
      canManageInvites: true,
      canManageMembers: true
    }
    mockUiConfig.value = {
      showMembersList: true,
      showPendingTab: true,
      showSearch: true
    }
  })

  describe('personal workspace', () => {
    beforeEach(() => {
      mockIsPersonalWorkspace.value = true
      mockIsOnTeamPlan.value = false
      mockShowSearch.value = false
      mockShowViewTabs.value = false
      mockIsInviteDisabled.value = true
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

  describe('team workspace - member table', () => {
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

    it('shows the Last activity and Credits columns', () => {
      mockFilteredMembers.value = [createMember()]
      renderComponent()
      expect(
        screen.getByText('workspacePanel.members.columns.lastActivity')
      ).toBeTruthy()
      expect(
        screen.getByText('workspacePanel.members.columns.creditsUsed')
      ).toBeTruthy()
    })

    it('renders the monthly credits for a member', () => {
      mockFilteredMembers.value = [createMember({ creditsUsedThisMonth: 6532 })]
      renderComponent()
      expect(screen.getByText('6,532')).toBeTruthy()
    })

    it('labels every owner-role member as Owner', () => {
      mockOriginalOwnerId.value = 'creator-1'
      mockFilteredMembers.value = [
        createMember({
          id: 'creator-1',
          email: 'creator@test.com',
          role: 'owner',
          isOriginalOwner: true
        }),
        createMember({ id: '2', email: 'owner@test.com', role: 'owner' })
      ]
      renderComponent()
      expect(screen.getAllByText('workspaceSwitcher.roleOwner')).toHaveLength(2)
    })

    it('renders filtered members', () => {
      mockFilteredMembers.value = [
        createMember({ name: 'Alice', email: 'alice@test.com' }),
        createMember({ id: '2', name: 'Bob', email: 'bob@test.com' })
      ]
      renderComponent()
      expect(screen.getByText('Alice')).toBeTruthy()
      expect(screen.getByText('Bob')).toBeTruthy()
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
        canViewPendingInvites: true,
        canInviteMembers: false,
        canManageInvites: false,
        canManageMembers: false
      }
      mockUiConfig.value.showPendingTab = true
    })

    it('shows the pending tab button (view-only)', () => {
      mockPendingInvites.value = [createInvite()]
      renderComponent()
      expect(
        screen.getByText(/workspacePanel\.members\.tabs\.pendingCount/)
      ).toBeTruthy()
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
      mockIsOnTeamPlan.value = true
      renderComponent()
      expect(
        screen.queryByText('workspacePanel.members.upsellBanner')
      ).toBeNull()
    })

    it('hides search input', () => {
      renderComponent()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('hides the contact us footer', () => {
      renderComponent()
      expect(screen.queryByText('workspacePanel.members.contactUs')).toBeNull()
    })
  })

  describe('contact us footer', () => {
    it('opens the team-plan request form in a new tab for team workspaces on a team plan', async () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
      renderComponent()
      expect(screen.getByText(/needMoreMembers/)).toBeTruthy()
      await userEvent.click(
        screen.getByText('workspacePanel.members.contactUs')
      )
      expect(openSpy).toHaveBeenCalledWith(
        'https://comfy-org.portal.usepylon.com/forms/team-plan-requests',
        '_blank',
        'noopener,noreferrer'
      )
      openSpy.mockRestore()
    })

    it('is hidden in personal workspaces', () => {
      mockIsPersonalWorkspace.value = true
      renderComponent()
      expect(screen.queryByText('workspacePanel.members.contactUs')).toBeNull()
    })
  })

  describe('member count tab', () => {
    it('shows the members count tab for team workspace', () => {
      mockMembers.value = [createMember({ id: '1' }), createMember({ id: '2' })]
      renderComponent()
      expect(
        screen.getByText(/workspacePanel\.members\.tabs\.membersCount/)
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
        screen.queryByText(/workspacePanel\.members\.tabs\.pendingCount/)
      ).toBeNull()
    })
  })
})
