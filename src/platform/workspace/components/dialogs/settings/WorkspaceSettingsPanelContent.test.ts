import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

import WorkspaceSettingsPanelContent from './WorkspaceSettingsPanelContent.vue'

const { mockFetchMembers, mockFetchPendingInvites } = vi.hoisted(() => ({
  mockFetchMembers: vi.fn(),
  mockFetchPendingInvites: vi.fn()
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () =>
    reactive({
      workspaceName: ref('Acme Team'),
      fetchMembers: mockFetchMembers,
      fetchPendingInvites: mockFetchPendingInvites
    })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ workspaceRole: ref('owner') })
}))

const stubs = {
  MembersPanelContent: { template: '<div data-testid="members-body" />' },
  PartnerNodeAccessPanel: { template: '<div data-testid="allowlist-body" />' },
  PlanCreditsPanelContent: {
    template:
      '<div data-testid="plan-body"><div role="status">Billing status</div></div>'
  },
  WorkspaceProfilePic: { template: '<div />' }
}

describe('WorkspaceSettingsPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchMembers.mockResolvedValue(undefined)
    mockFetchPendingInvites.mockResolvedValue(undefined)
  })

  it('keeps the billing banner within the plan and credits section', async () => {
    const { rerender } = render(WorkspaceSettingsPanelContent, {
      props: { section: 'planCredits' },
      global: { stubs }
    })

    expect(screen.getByTestId('plan-body')).toBeInTheDocument()
    expect(screen.queryByTestId('members-body')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Acme Team' })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    await rerender({ section: 'members' })

    expect(screen.queryByTestId('plan-body')).not.toBeInTheDocument()
    expect(screen.getByTestId('members-body')).toBeInTheDocument()
    expect(mockFetchMembers).toHaveBeenCalledTimes(1)
    expect(mockFetchPendingInvites).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await rerender({ section: 'allowlist' })

    expect(screen.queryByTestId('members-body')).not.toBeInTheDocument()
    expect(screen.getByTestId('allowlist-body')).toBeInTheDocument()
    expect(mockFetchMembers).toHaveBeenCalledTimes(1)
    expect(mockFetchPendingInvites).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
