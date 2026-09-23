import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspaceMembersPanelContent from './WorkspaceMembersPanelContent.vue'

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

const stubs = {
  MembersPanelContent: { template: '<div data-testid="members-body" />' }
}

describe('WorkspaceMembersPanelContent', () => {
  let workspaceStore: ReturnType<typeof useTeamWorkspaceStore>

  beforeEach(() => {
    Object.assign(useWorkspaceUI(), { workspaceRole: ref('owner') })
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
