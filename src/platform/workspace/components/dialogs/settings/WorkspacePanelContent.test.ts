import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspacePanelContent from './WorkspacePanelContent.vue'

const mockFetchMembers = vi.fn()
const mockFetchPendingInvites = vi.fn()

const { mockHasTeamPlan, mockIsPlanLoading, mockMembers, mockWorkspaceType } =
  vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const { ref } = require('vue') as typeof import('vue')

    return {
      mockHasTeamPlan: ref(true),
      mockIsPlanLoading: ref(false),
      mockMembers: ref<WorkspaceMember[]>([]),
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    useWorkspaceUI: () => ({
      workspaceType: mockWorkspaceType,
      workspaceRole: ref('owner')
    })
  }
})

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

function renderComponent() {
  return render(WorkspacePanelContent, {
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
    mockWorkspaceType.value = 'team'
  })

  it('keeps the legacy tabs without Activity and shares one banner', async () => {
    renderComponent()

    const planTab = screen.getByRole('tab', {
      name: 'workspacePanel.tabs.planCredits'
    })
    const membersTab = screen.getByRole('tab', {
      name: 'workspacePanel.members.header'
    })
    const banner = screen.getByTestId('billing-banner')

    expect(planTab).toBeTruthy()
    expect(membersTab).toBeTruthy()
    expect(
      screen.queryByRole('tab', {
        name: 'workspacePanel.planCredits.tabs.activity'
      })
    ).toBeNull()
    expect(
      planTab.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    await userEvent.click(membersTab)
    expect(screen.getAllByTestId('billing-banner')).toHaveLength(1)
    expect(screen.getByTestId('billing-banner')).toBe(banner)
  })
})

describe('WorkspacePanelContent members tab label', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTeamPlan.value = true
    mockIsPlanLoading.value = false
    mockMembers.value = []
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
