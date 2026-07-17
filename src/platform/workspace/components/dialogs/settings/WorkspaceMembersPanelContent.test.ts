import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import WorkspaceMembersPanelContent from './WorkspaceMembersPanelContent.vue'

const { mockFetchMembers, mockFetchPendingInvites } = vi.hoisted(() => ({
  mockFetchMembers: vi.fn(),
  mockFetchPendingInvites: vi.fn()
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    fetchMembers: mockFetchMembers,
    fetchPendingInvites: mockFetchPendingInvites
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ workspaceRole: ref('owner') })
}))

const stubs = {
  MembersPanelContent: { template: '<div data-testid="members-body" />' }
}

describe('WorkspaceMembersPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchMembers.mockResolvedValue(undefined)
    mockFetchPendingInvites.mockResolvedValue(undefined)
  })

  it('fetches members and pending invites on mount', () => {
    render(WorkspaceMembersPanelContent, { global: { stubs } })
    expect(mockFetchMembers).toHaveBeenCalled()
    expect(mockFetchPendingInvites).toHaveBeenCalled()
  })

  it('settles rejected loading requests', async () => {
    mockFetchMembers.mockRejectedValueOnce(new Error('members failed'))
    mockFetchPendingInvites.mockRejectedValueOnce(new Error('invites failed'))

    render(WorkspaceMembersPanelContent, { global: { stubs } })
    await Promise.resolve()

    expect(mockFetchMembers).toHaveBeenCalled()
    expect(mockFetchPendingInvites).toHaveBeenCalled()
  })
})
