import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MembersPanelContent from './MembersPanelContent.vue'

import type {
  PendingInvite,
  WorkspaceMember
} from '../../../stores/teamWorkspaceStore'

const mockHandleCopyInviteLink = vi.fn()
const mockHandleRevokeInvite = vi.fn()
const mockHandleCreateWorkspace = vi.fn()
const mockShowSubscriptionDialog = vi.fn()
const mockSelectMember = vi.fn()
const mockToggleSort = vi.fn()

const {
  mockMembers,
  mockPendingInvites,
  mockFilteredMembers,
  mockFilteredPendingInvites,
  mockIsPersonalWorkspace,
  mockIsSingleSeatPlan,
  mockIsActiveSubscription,
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
    mockFilteredMembers: ref<WorkspaceMember[]>([]),
    mockFilteredPendingInvites: ref<PendingInvite[]>([]),
    mockIsPersonalWorkspace: ref(false),
    mockIsSingleSeatPlan: ref(false),
    mockIsActiveSubscription: ref(true),
    mockActiveView: ref<'active' | 'pending'>('active'),
    mockSearchQuery: ref(''),
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
    })
  }
})

vi.mock('@/platform/workspace/composables/useMembersPanel', () => ({
  useMembersPanel: () => ({
    searchQuery: mockSearchQuery,
    activeView: mockActiveView,
    maxSeats: computed(() => 20),
    isSingleSeatPlan: mockIsSingleSeatPlan,
    personalWorkspaceMember: computed(() => ({
      id: 'self',
      name: 'Owner User',
      email: 'owner@example.com',
      role: 'owner' as const,
      joinDate: new Date(0)
    })),
    filteredMembers: mockFilteredMembers,
    filteredPendingInvites: mockFilteredPendingInvites,
    memberMenuItems: computed(() => []),
    isPersonalWorkspace: mockIsPersonalWorkspace,
    members: mockMembers,
    pendingInvites: mockPendingInvites,
    permissions: mockPermissions,
    uiConfig: mockUiConfig,
    isActiveSubscription: mockIsActiveSubscription,
    userPhotoUrl: ref(null),
    isCurrentUser: (m: WorkspaceMember) =>
      m.email.toLowerCase() === 'owner@example.com',
    selectMember: mockSelectMember,
    toggleSort: mockToggleSort,
    showSubscriptionDialog: mockShowSubscriptionDialog,
    handleCopyInviteLink: mockHandleCopyInviteLink,
    handleRevokeInvite: mockHandleRevokeInvite,
    handleCreateWorkspace: mockHandleCreateWorkspace,
    handleRemoveMember: vi.fn()
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

function renderComponent() {
  return render(MembersPanelContent, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        SearchInput: SearchInputStub,
        UserAvatar: true,
        Menu: { template: '<div />', props: ['model', 'popup'] }
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

describe('MembersPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMembers.value = []
    mockPendingInvites.value = []
    mockFilteredMembers.value = []
    mockFilteredPendingInvites.value = []
    mockIsPersonalWorkspace.value = false
    mockIsSingleSeatPlan.value = false
    mockIsActiveSubscription.value = true
    mockActiveView.value = 'active'
    mockSearchQuery.value = ''
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
    beforeEach(() => {
      mockIsPersonalWorkspace.value = true
      mockUiConfig.value.showMembersList = false
      mockUiConfig.value.showSearch = false
      mockUiConfig.value.showPendingTab = false
    })

    it('shows personal workspace message and create workspace button', () => {
      renderComponent()
      expect(
        screen.getByText('workspacePanel.members.personalWorkspaceMessage')
      ).toBeTruthy()
      expect(
        screen.getByText('workspacePanel.members.createNewWorkspace')
      ).toBeTruthy()
    })

    it('calls handleCreateWorkspace when create button is clicked', async () => {
      renderComponent()
      await userEvent.click(
        screen.getByText('workspacePanel.members.createNewWorkspace')
      )
      expect(mockHandleCreateWorkspace).toHaveBeenCalled()
    })

    it('does not show search input', () => {
      renderComponent()
      expect(screen.queryByRole('textbox')).toBeNull()
    })
  })

  describe('team workspace - member list', () => {
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
  })

  describe('pending invites tab', () => {
    it('shows pending tab button when configured', () => {
      mockPendingInvites.value = [createInvite()]
      renderComponent()
      expect(
        screen.getByText(/workspacePanel\.members\.tabs\.pendingCount/)
      ).toBeTruthy()
    })

    it('triggers handleRevokeInvite on revoke click', async () => {
      mockActiveView.value = 'pending'
      mockFilteredPendingInvites.value = [createInvite({ id: 'inv-42' })]
      renderComponent()
      const revokeBtn = screen.getByRole('button', {
        name: 'workspacePanel.members.actions.revokeInvite'
      })
      await userEvent.click(revokeBtn)
      expect(mockHandleRevokeInvite).toHaveBeenCalled()
    })

    it('triggers handleCopyInviteLink on copy click', async () => {
      mockActiveView.value = 'pending'
      mockFilteredPendingInvites.value = [createInvite({ id: 'inv-42' })]
      renderComponent()
      const copyBtn = screen.getByRole('button', {
        name: 'workspacePanel.members.actions.copyLink'
      })
      await userEvent.click(copyBtn)
      expect(mockHandleCopyInviteLink).toHaveBeenCalled()
    })
  })

  describe('single seat plan', () => {
    beforeEach(() => {
      mockIsSingleSeatPlan.value = true
    })

    it('shows upsell banner', () => {
      renderComponent()
      expect(
        screen.getByText('workspacePanel.members.upsellBannerUpgrade')
      ).toBeTruthy()
    })

    it('opens subscription dialog on view plans click', async () => {
      renderComponent()
      const viewPlansBtn = screen.getByRole('button', {
        name: /workspacePanel\.members\.viewPlans/
      })
      await userEvent.click(viewPlansBtn)
      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
    })

    it('hides search input', () => {
      renderComponent()
      expect(screen.queryByRole('textbox')).toBeNull()
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
})
