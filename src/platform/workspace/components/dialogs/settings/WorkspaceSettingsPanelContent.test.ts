import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted, onUnmounted, ref } from 'vue'

import WorkspaceSettingsPanelContent from './WorkspaceSettingsPanelContent.vue'

const { mockBannerMounted, mockBannerUnmounted } = vi.hoisted(() => ({
  mockBannerMounted: vi.fn(),
  mockBannerUnmounted: vi.fn()
}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useWorkspaceUI'),
  () => ({
    useWorkspaceUI: () => ({ workspaceRole: ref('owner') })
  })
)

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
  PartnerNodeAccessPanel: { template: '<div data-testid="allowlist-body" />' },
  PlanCreditsPanelContent: { template: '<div data-testid="plan-body" />' },
  WorkspaceProfilePic: { template: '<div />' }
}

beforeEach(() => {
  Object.assign(useTeamWorkspaceStore(), { workspaceName: 'Acme Team' })
  vi.mocked(useTeamWorkspaceStore().fetchMembers).mockResolvedValue([])
  vi.mocked(useTeamWorkspaceStore().fetchPendingInvites).mockResolvedValue([])
})

describe('WorkspaceSettingsPanelContent', () => {
  beforeEach(() => {
    vi.mocked(useTeamWorkspaceStore().fetchMembers).mockResolvedValue([])
    vi.mocked(useTeamWorkspaceStore().fetchPendingInvites).mockResolvedValue([])
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
    expect(useTeamWorkspaceStore().fetchMembers).toHaveBeenCalledTimes(1)
    expect(useTeamWorkspaceStore().fetchPendingInvites).toHaveBeenCalledTimes(1)
    expect(mockBannerMounted).toHaveBeenCalledTimes(1)
    expect(mockBannerUnmounted).not.toHaveBeenCalled()

    await rerender({ section: 'allowlist' })

    expect(screen.queryByTestId('members-body')).not.toBeInTheDocument()
    expect(screen.getByTestId('allowlist-body')).toBeInTheDocument()
    expect(useTeamWorkspaceStore().fetchMembers).toHaveBeenCalledTimes(1)
    expect(useTeamWorkspaceStore().fetchPendingInvites).toHaveBeenCalledTimes(1)
    expect(mockBannerMounted).toHaveBeenCalledTimes(1)
    expect(mockBannerUnmounted).not.toHaveBeenCalled()

    unmount()
    expect(mockBannerUnmounted).toHaveBeenCalledTimes(1)
  })
})
