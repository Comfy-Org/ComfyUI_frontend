import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted, onUnmounted, reactive, ref } from 'vue'

import WorkspaceSettingsPanelContent from './WorkspaceSettingsPanelContent.vue'

const {
  mockBannerMounted,
  mockBannerUnmounted,
  mockFetchMembers,
  mockFetchPendingInvites
} = vi.hoisted(() => ({
  mockBannerMounted: vi.fn(),
  mockBannerUnmounted: vi.fn(),
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

const BillingStatusBanner = defineComponent({
  setup() {
    onMounted(mockBannerMounted)
    onUnmounted(mockBannerUnmounted)
    return () => h('div', { 'data-testid': 'billing-banner' })
  }
})

const stubs = {
  BillingStatusBanner,
  MembersPanelContent: { template: '<div data-testid="members-body" />' },
  PlanCreditsPanelContent: { template: '<div data-testid="plan-body" />' },
  WorkspaceProfilePic: { template: '<div />' }
}

describe('WorkspaceSettingsPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchMembers.mockResolvedValue(undefined)
    mockFetchPendingInvites.mockResolvedValue(undefined)
  })

  it('keeps the billing banner mounted while switching sections', async () => {
    const { rerender, unmount } = render(WorkspaceSettingsPanelContent, {
      props: { section: 'planCredits' },
      global: { stubs }
    })

    expect(screen.getByTestId('plan-body')).toBeInTheDocument()
    expect(screen.queryByTestId('members-body')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Acme Team' })
    ).toBeInTheDocument()
    expect(mockBannerMounted).toHaveBeenCalledTimes(1)
    expect(mockBannerUnmounted).not.toHaveBeenCalled()

    await rerender({ section: 'members' })

    expect(screen.queryByTestId('plan-body')).not.toBeInTheDocument()
    expect(screen.getByTestId('members-body')).toBeInTheDocument()
    expect(mockFetchMembers).toHaveBeenCalledTimes(1)
    expect(mockFetchPendingInvites).toHaveBeenCalledTimes(1)
    expect(mockBannerMounted).toHaveBeenCalledTimes(1)
    expect(mockBannerUnmounted).not.toHaveBeenCalled()

    unmount()
    expect(mockBannerUnmounted).toHaveBeenCalledTimes(1)
  })
})
