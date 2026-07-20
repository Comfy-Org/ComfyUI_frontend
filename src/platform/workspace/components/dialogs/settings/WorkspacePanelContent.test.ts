import { render, screen } from '@testing-library/vue'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspacePanelContent from './WorkspacePanelContent.vue'

const mockFetchMembers = vi.fn()
const mockFetchPendingInvites = vi.fn()

const {
  mockGovernedWorkspaceId,
  mockHasTeamPlan,
  mockIsPlanLoading,
  mockMembers,
  mockWorkspaceRole,
  mockWorkspaceType
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockGovernedWorkspaceId: ref<string | null>('workspace-one'),
    mockHasTeamPlan: ref(true),
    mockIsPlanLoading: ref(false),
    mockMembers: ref<WorkspaceMember[]>([]),
    mockWorkspaceRole: ref<'owner' | 'member'>('owner'),
    mockWorkspaceType: ref<'personal' | 'team'>('team')
  }
})

vi.mock('@/platform/workspace/composables/useTeamPlan', () => ({
  useTeamPlan: () => ({
    hasTeamPlan: mockHasTeamPlan,
    isPlanLoading: mockIsPlanLoading
  })
}))

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
      members: mockMembers,
      fetchMembers: mockFetchMembers,
      fetchPendingInvites: mockFetchPendingInvites
    })
  }
})

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => {
  return {
    useWorkspaceUI: () => ({
      workspaceType: mockWorkspaceType,
      workspaceRole: mockWorkspaceRole
    })
  }
})

vi.mock('@/platform/workspace/stores/partnerNodeGovernanceStore', () => ({
  usePartnerNodeGovernanceStore: () => ({
    governedWorkspaceId: mockGovernedWorkspaceId
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

vi.mock(
  '@/platform/workspace/components/dialogs/settings/BillingStatusBanner.vue',
  () => ({
    default: {
      name: 'BillingStatusBanner',
      template: '<div data-testid="billing-banner" />'
    }
  })
)

vi.mock(
  '@/platform/workspace/components/dialogs/settings/PartnerNodeAllowlistPanel.vue',
  () => ({ default: { template: '<div />' } })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function createMember(id: string): WorkspaceMember {
  return {
    id,
    name: `Member ${id}`,
    email: `member${id}@example.com`,
    joinDate: new Date('2025-01-15'),
    role: 'member',
    isOriginalOwner: false
  }
}

function renderComponent(defaultTab?: string) {
  return render(WorkspacePanelContent, {
    props: { defaultTab },
    global: {
      plugins: [i18n],
      stubs: { WorkspaceProfilePic: true }
    }
  })
}

describe('WorkspacePanelContent billing banner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMembers.value = []
    mockGovernedWorkspaceId.value = 'workspace-one'
    mockWorkspaceRole.value = 'owner'
    mockWorkspaceType.value = 'team'
  })

  it('hosts a single banner slot above the tab content, so it shows on every tab', () => {
    renderComponent()

    const banner = screen.getByTestId('billing-banner')
    const planPanel = screen.getByText('workspacePanel.tabs.planCredits')
    expect(
      planPanel.compareDocumentPosition(banner) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('WorkspacePanelContent members tab label', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTeamPlan.value = true
    mockIsPlanLoading.value = false
    mockMembers.value = []
    mockGovernedWorkspaceId.value = 'workspace-one'
    mockWorkspaceRole.value = 'owner'
    mockWorkspaceType.value = 'team'
  })

  it('shows the counted label for Team plans with multiple members', () => {
    mockMembers.value = [createMember('1'), createMember('2')]
    renderComponent()
    expect(screen.getByText(/workspacePanel\.tabs\.membersCount/)).toBeTruthy()
  })

  it('drops the count when the owner is the only member', () => {
    mockMembers.value = [createMember('1')]
    renderComponent()
    expect(screen.getByText('workspacePanel.members.header')).toBeTruthy()
    expect(screen.queryByText(/workspacePanel\.tabs\.membersCount/)).toBeNull()
  })

  it('shows the plain Members label for a personal plan', () => {
    mockWorkspaceType.value = 'personal'
    mockHasTeamPlan.value = false
    mockMembers.value = [createMember('1'), createMember('2')]
    renderComponent()
    expect(screen.getByText('workspacePanel.members.header')).toBeTruthy()
    expect(screen.queryByText(/workspacePanel\.tabs\.membersCount/)).toBeNull()
  })

  it('fetches members and pending invites for a Team plan', () => {
    mockWorkspaceType.value = 'personal'
    renderComponent()
    expect(mockFetchMembers).toHaveBeenCalled()
    expect(mockFetchPendingInvites).toHaveBeenCalled()
  })

  it('does not fetch member data for a personal plan', () => {
    mockWorkspaceType.value = 'team'
    mockHasTeamPlan.value = false
    renderComponent()
    expect(mockFetchMembers).not.toHaveBeenCalled()
    expect(mockFetchPendingInvites).not.toHaveBeenCalled()
  })

  it('waits for billing initialization before fetching member data', () => {
    mockIsPlanLoading.value = true
    renderComponent()
    expect(mockFetchMembers).not.toHaveBeenCalled()
    expect(mockFetchPendingInvites).not.toHaveBeenCalled()
  })
})

describe('WorkspacePanelContent allowlist tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGovernedWorkspaceId.value = 'workspace-one'
    mockWorkspaceRole.value = 'owner'
    mockWorkspaceType.value = 'team'
  })

  it('shows the allowlist for an eligible workspace owner', () => {
    renderComponent()

    expect(
      screen.getByRole('tab', { name: 'workspacePanel.tabs.allowlist' })
    ).toBeInTheDocument()
  })

  it('hides the allowlist from workspace members', () => {
    mockWorkspaceRole.value = 'member'
    renderComponent()

    expect(
      screen.queryByRole('tab', { name: 'workspacePanel.tabs.allowlist' })
    ).toBeNull()
  })

  it('hides the allowlist when governance is ineligible', () => {
    mockGovernedWorkspaceId.value = null
    renderComponent()

    expect(
      screen.queryByRole('tab', { name: 'workspacePanel.tabs.allowlist' })
    ).toBeNull()
  })

  it('falls back when allowlist access is unavailable on mount', () => {
    mockWorkspaceRole.value = 'member'
    renderComponent('allowlist')

    expect(
      screen.getByRole('tab', { name: 'workspacePanel.tabs.planCredits' })
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to a valid tab when allowlist access is lost', async () => {
    renderComponent('allowlist')

    expect(
      screen.getByRole('tab', { name: 'workspacePanel.tabs.allowlist' })
    ).toHaveAttribute('aria-selected', 'true')

    mockWorkspaceRole.value = 'member'
    await nextTick()

    expect(
      screen.queryByRole('tab', { name: 'workspacePanel.tabs.allowlist' })
    ).toBeNull()
    expect(
      screen.getByRole('tab', { name: 'workspacePanel.tabs.planCredits' })
    ).toHaveAttribute('aria-selected', 'true')
  })
})
