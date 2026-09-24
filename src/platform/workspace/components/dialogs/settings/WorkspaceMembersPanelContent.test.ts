import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspaceMembersPanelContent from './WorkspaceMembersPanelContent.vue'

vi.mock<unknown>(
  import('@/platform/workspace/composables/useWorkspaceUI'),
  () => ({
    useWorkspaceUI: () => ({ workspaceRole: ref('owner') })
  })
)

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

  it('shows no error state when both fetches succeed', async () => {
    renderComponent()
    await Promise.resolve()

    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })
})
