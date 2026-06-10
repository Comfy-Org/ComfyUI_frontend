import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WorkspacePanelContent from './WorkspacePanelContent.vue'

const mockShowInviteMemberDialog = vi.fn()
const mockShowInviteMemberUpsellDialog = vi.fn()
const mockFetchMembers = vi.fn()
const mockFetchPendingInvites = vi.fn()

const {
  mockIsOnTeamPlan,
  mockMaxSeats,
  mockTotalMemberSlots,
  mockIsInviteLimitReached,
  mockWorkspaceType,
  mockPermissions,
  mockUiConfig
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockIsOnTeamPlan: ref(true),
    mockMaxSeats: ref(20),
    mockTotalMemberSlots: ref(0),
    mockIsInviteLimitReached: ref(false),
    mockWorkspaceType: ref<'personal' | 'team'>('team'),
    mockPermissions: ref({
      canInviteMembers: true,
      canAccessWorkspaceMenu: true
    }),
    mockUiConfig: ref({
      showEditWorkspaceMenuItem: true,
      workspaceMenuAction: 'delete' as 'leave' | 'delete' | null,
      workspaceMenuDisabledTooltip: null as string | null
    })
  }
})

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    useTeamWorkspaceStore: () => ({
      workspaceName: ref('Acme Team'),
      members: ref([]),
      totalMemberSlots: mockTotalMemberSlots,
      isInviteLimitReached: mockIsInviteLimitReached,
      isWorkspaceSubscribed: ref(true),
      fetchMembers: mockFetchMembers,
      fetchPendingInvites: mockFetchPendingInvites
    })
  }
})

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    useWorkspaceUI: () => ({
      workspaceType: mockWorkspaceType,
      workspaceRole: ref('owner'),
      permissions: mockPermissions,
      uiConfig: mockUiConfig
    })
  }
})

vi.mock('@/platform/workspace/composables/useTeamPlan', () => ({
  useTeamPlan: () => ({
    isOnTeamPlan: mockIsOnTeamPlan,
    maxSeats: mockMaxSeats
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showLeaveWorkspaceDialog: vi.fn(),
    showDeleteWorkspaceDialog: vi.fn(),
    showInviteMemberDialog: mockShowInviteMemberDialog,
    showInviteMemberUpsellDialog: mockShowInviteMemberUpsellDialog,
    showEditWorkspaceDialog: vi.fn()
  })
}))

vi.mock(
  '@/platform/workspace/components/SubscriptionPanelContentWorkspace.vue',
  () => ({
    default: { name: 'SubscriptionPanelContentWorkspace', template: '<div />' }
  })
)

vi.mock(
  '@/platform/workspace/components/dialogs/settings/MembersPanelContent.vue',
  () => ({
    default: { name: 'MembersPanelContent', template: '<div />' }
  })
)

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

function renderComponent() {
  return render(WorkspacePanelContent, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        WorkspaceProfilePic: true,
        Menu: { template: '<div />', props: ['model', 'popup'] }
      },
      directives: { tooltip: () => {} }
    }
  })
}

function getInviteButton() {
  return screen.getByRole('button', {
    name: 'workspacePanel.inviteMember'
  })
}

describe('WorkspacePanelContent invite gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsOnTeamPlan.value = true
    mockMaxSeats.value = 20
    mockTotalMemberSlots.value = 0
    mockIsInviteLimitReached.value = false
    mockWorkspaceType.value = 'team'
    mockPermissions.value = {
      canInviteMembers: true,
      canAccessWorkspaceMenu: true
    }
  })

  it('opens the invite dialog on an active team plan', async () => {
    renderComponent()
    await userEvent.click(getInviteButton())
    expect(mockShowInviteMemberDialog).toHaveBeenCalled()
    expect(mockShowInviteMemberUpsellDialog).not.toHaveBeenCalled()
  })

  it('opens the upsell dialog when not on a team plan', async () => {
    mockIsOnTeamPlan.value = false
    renderComponent()
    await userEvent.click(getInviteButton())
    expect(mockShowInviteMemberUpsellDialog).toHaveBeenCalled()
    expect(mockShowInviteMemberDialog).not.toHaveBeenCalled()
  })

  it('disables the invite button when plan seats are filled', () => {
    mockMaxSeats.value = 5
    mockTotalMemberSlots.value = 5
    renderComponent()
    expect((getInviteButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the invite button enabled below the plan seat count', async () => {
    mockMaxSeats.value = 5
    mockTotalMemberSlots.value = 4
    renderComponent()
    await userEvent.click(getInviteButton())
    expect(mockShowInviteMemberDialog).toHaveBeenCalled()
  })

  it('disables the invite button at the flat backend member cap', () => {
    mockIsInviteLimitReached.value = true
    renderComponent()
    expect((getInviteButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the invite button clickable for upsell when off team plan at the limit', async () => {
    mockIsOnTeamPlan.value = false
    mockIsInviteLimitReached.value = true
    renderComponent()
    await userEvent.click(getInviteButton())
    expect(mockShowInviteMemberUpsellDialog).toHaveBeenCalled()
  })

  it('hides the invite button for team members without invite permission', () => {
    mockPermissions.value = {
      canInviteMembers: false,
      canAccessWorkspaceMenu: true
    }
    renderComponent()
    expect(
      screen.queryByRole('button', { name: 'workspacePanel.inviteMember' })
    ).toBeNull()
  })

  it('renders the invite button disabled in a personal workspace', () => {
    mockWorkspaceType.value = 'personal'
    mockIsOnTeamPlan.value = false
    mockPermissions.value = {
      canInviteMembers: false,
      canAccessWorkspaceMenu: false
    }
    renderComponent()
    expect((getInviteButton() as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('WorkspacePanelContent members tab label', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceType.value = 'team'
    mockIsOnTeamPlan.value = true
  })

  it('shows the counted label for team workspaces', () => {
    renderComponent()
    expect(screen.getByText(/workspacePanel\.tabs\.membersCount/)).toBeTruthy()
  })

  it('shows the plain Members label for personal workspaces', () => {
    mockWorkspaceType.value = 'personal'
    renderComponent()
    expect(screen.getByText('workspacePanel.members.header')).toBeTruthy()
    expect(screen.queryByText(/workspacePanel\.tabs\.membersCount/)).toBeNull()
  })
})
