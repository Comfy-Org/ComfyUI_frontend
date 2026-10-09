import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspaceMembersPanelContent from './WorkspaceMembersPanelContent.vue'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

const stubs = {
  MembersPanelContent: { template: '<div data-testid="members-body" />' }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function renderComponent() {
  return render(WorkspaceMembersPanelContent, {
    global: { stubs, plugins: [i18n] }
  })
}

describe('WorkspaceMembersPanelContent', () => {
  let workspaceStore: ReturnType<typeof useTeamWorkspaceStore>

  beforeEach(() => {
    useBillingCapabilities().canManageMembers = computed(() => true)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    workspaceUI.workspaceRole = computed(() => 'owner')
    const ownerPermissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...ownerPermissions,
      canViewPendingInvites: true
    }))
    workspaceStore = useTeamWorkspaceStore()
    vi.mocked(workspaceStore.fetchMembers).mockResolvedValue([])
    vi.mocked(workspaceStore.fetchPendingInvites).mockResolvedValue([])
  })

  it('fetches members and pending invites on mount', () => {
    renderComponent()
    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalled()
  })

  it('surfaces a retryable error when a fetch fails, and clears it on retry', async () => {
    vi.mocked(workspaceStore.fetchMembers).mockRejectedValueOnce(
      new Error('members failed')
    )

    renderComponent()

    expect(
      await screen.findByText('workspacePanel.members.loadFailed')
    ).toBeInTheDocument()
    expect(screen.getByTestId('members-body')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'g.retry' }))

    await waitFor(() =>
      expect(
        screen.queryByText('workspacePanel.members.loadFailed')
      ).not.toBeInTheDocument()
    )
    expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(2)
  })

  it('skips the invites fetch for members who cannot view pending invites', async () => {
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const permissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...permissions,
      canViewPendingInvites: false
    }))
    useBillingCapabilities().canManageMembers = computed(() => false)
    vi.mocked(workspaceStore.fetchPendingInvites).mockRejectedValue(
      new Error('403')
    )

    renderComponent()
    await Promise.resolve()

    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).not.toHaveBeenCalled()
    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })

  it('loads personal-owner pending invites once management resolves', async () => {
    const canManage = ref(false)
    useBillingCapabilities().canManageMembers = computed(() => canManage.value)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const permissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...permissions,
      canViewPendingInvites: false
    }))

    renderComponent()
    expect(workspaceStore.fetchPendingInvites).not.toHaveBeenCalled()

    canManage.value = true

    await waitFor(() =>
      expect(workspaceStore.fetchPendingInvites).toHaveBeenCalledTimes(1)
    )
  })

  it('shows no error state when both fetches succeed', async () => {
    renderComponent()
    await Promise.resolve()

    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })
})
