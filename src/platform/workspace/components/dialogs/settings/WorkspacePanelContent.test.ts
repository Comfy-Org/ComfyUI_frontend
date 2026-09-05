import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspacePanelContent from './WorkspacePanelContent.vue'

const { mockMaxSeats, mockIsPlanLoading } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockMaxSeats: ref<number | null>(20),
    mockIsPlanLoading: ref(false)
  }
})

let pinia: ReturnType<typeof createTestingPinia>
let workspaceStore: ReturnType<typeof useTeamWorkspaceStore> & {
  activeWorkspaceId: string | null
}
let members: WorkspaceMember[]
let workspaceType: 'personal' | 'team'

vi.mock('@/platform/workspace/composables/useTeamPlan', () => ({
  useTeamPlan: () => ({
    maxSeats: mockMaxSeats,
    hasMemberSeats: computed(
      () => mockMaxSeats.value === 0 || (mockMaxSeats.value ?? 0) > 1
    ),
    isPlanLoading: mockIsPlanLoading
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')
  return {
    useWorkspaceUI: () => ({
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
  workspaceStore.workspaces = [
    {
      id: 'workspace-one',
      name: 'Acme Team',
      type: workspaceType,
      role: 'owner',
      created_at: '2025-01-01',
      joined_at: '2025-01-01',
      isSubscribed: true,
      subscriptionPlan: null,
      subscriptionTier: workspaceType === 'team' ? 'PRO' : 'FREE',
      members,
      pendingInvites: []
    }
  ]
  workspaceStore.activeWorkspaceId = 'workspace-one'

  return render(WorkspacePanelContent, {
    global: {
      plugins: [pinia, i18n],
      stubs: { WorkspaceProfilePic: true }
    }
  })
}

beforeEach(() => {
  pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  workspaceStore = useTeamWorkspaceStore(pinia)
  vi.mocked(workspaceStore.fetchMembers).mockResolvedValue([])
  vi.mocked(workspaceStore.fetchPendingInvites).mockResolvedValue([])
  mockMaxSeats.value = 20
  mockIsPlanLoading.value = false
  members = []
  workspaceType = 'team'
})

describe('WorkspacePanelContent billing banner', () => {
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
  it('shows the counted label for Team plans with multiple members', () => {
    members = [createMember('1'), createMember('2')]
    renderComponent()
    expect(screen.getByText(/workspacePanel\.tabs\.membersCount/)).toBeTruthy()
  })

  it('drops the count when the owner is the only member', () => {
    members = [createMember('1')]
    renderComponent()
    expect(screen.getByText('workspacePanel.members.header')).toBeTruthy()
    expect(screen.queryByText(/workspacePanel\.tabs\.membersCount/)).toBeNull()
  })

  it('shows the plain Members label for a personal plan', () => {
    workspaceType = 'personal'
    mockMaxSeats.value = 1
    members = [createMember('1'), createMember('2')]
    renderComponent()
    expect(screen.getByText('workspacePanel.members.header')).toBeTruthy()
    expect(screen.queryByText(/workspacePanel\.tabs\.membersCount/)).toBeNull()
  })

  it('fetches members and pending invites for a Team plan', () => {
    workspaceType = 'team'
    renderComponent()
    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalled()
  })

  it('does not fetch member data for a personal plan', () => {
    workspaceType = 'personal'
    mockMaxSeats.value = 1
    renderComponent()
    expect(workspaceStore.fetchMembers).not.toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).not.toHaveBeenCalled()
  })

  it('waits for billing initialization before fetching member data', () => {
    mockIsPlanLoading.value = true
    renderComponent()
    expect(workspaceStore.fetchMembers).not.toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).not.toHaveBeenCalled()
  })

  it('fetches team member data while seat capacity is unresolved', () => {
    workspaceType = 'team'
    mockMaxSeats.value = null
    renderComponent()
    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalled()
  })

  it('fetches personal member data while seat capacity is unresolved', () => {
    workspaceType = 'personal'
    mockMaxSeats.value = null
    renderComponent()
    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalled()
  })
})
