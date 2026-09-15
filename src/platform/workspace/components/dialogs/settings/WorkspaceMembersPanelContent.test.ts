import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

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

describe('WorkspaceMembersPanelContent', () => {
  let workspaceStore: ReturnType<typeof useTeamWorkspaceStore>

  beforeEach(() => {
    workspaceStore = useTeamWorkspaceStore()
    vi.mocked(workspaceStore.fetchMembers).mockResolvedValue([])
    vi.mocked(workspaceStore.fetchPendingInvites).mockResolvedValue([])
  })

  it('fetches members and pending invites on mount', () => {
    render(WorkspaceMembersPanelContent, { global: { stubs } })
    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalled()
  })

  it('settles rejected loading requests', async () => {
    vi.mocked(workspaceStore.fetchMembers).mockRejectedValueOnce(
      new Error('members failed')
    )
    vi.mocked(workspaceStore.fetchPendingInvites).mockRejectedValueOnce(
      new Error('invites failed')
    )

    render(WorkspaceMembersPanelContent, { global: { stubs } })
    await Promise.resolve()

    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalled()
  })
})
