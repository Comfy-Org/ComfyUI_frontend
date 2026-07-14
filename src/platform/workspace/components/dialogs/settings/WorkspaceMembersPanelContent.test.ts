import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

import WorkspaceMembersPanelContent from './WorkspaceMembersPanelContent.vue'

const { mockFetchMembers, mockFetchPendingInvites } = vi.hoisted(() => ({
  mockFetchMembers: vi.fn(),
  mockFetchPendingInvites: vi.fn()
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () =>
    reactive({
      workspaceName: 'Acme Team',
      fetchMembers: mockFetchMembers,
      fetchPendingInvites: mockFetchPendingInvites
    })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ workspaceRole: ref('owner') })
}))

const stubs = {
  WorkspaceProfilePic: { template: '<div />' },
  MembersPanelContent: { template: '<div data-testid="members-body" />' }
}

describe('WorkspaceMembersPanelContent', () => {
  it('fetches members and pending invites on mount', () => {
    render(WorkspaceMembersPanelContent, { global: { stubs } })
    expect(mockFetchMembers).toHaveBeenCalled()
    expect(mockFetchPendingInvites).toHaveBeenCalled()
  })
})
