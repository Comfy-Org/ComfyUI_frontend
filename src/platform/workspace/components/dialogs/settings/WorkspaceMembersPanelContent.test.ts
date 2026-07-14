import { render, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import WorkspaceMembersPanelContent from './WorkspaceMembersPanelContent.vue'

const mockEnsureMembersLoaded = vi.fn()
const mockFetchPendingInvites = vi.fn()

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ workspaceRole: ref('owner') })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    ensureMembersLoaded: mockEnsureMembersLoaded,
    fetchPendingInvites: mockFetchPendingInvites
  })
}))

describe('WorkspaceMembersPanelContent', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureMembersLoaded.mockResolvedValue(undefined)
    mockFetchPendingInvites.mockResolvedValue(undefined)
  })

  it('loads members and pending invites on mount', () => {
    render(WorkspaceMembersPanelContent, {
      global: { stubs: { MembersPanelContent: true } }
    })

    expect(mockEnsureMembersLoaded).toHaveBeenCalledOnce()
    expect(mockFetchPendingInvites).toHaveBeenCalledOnce()
  })

  it('handles pending invite load failures', async () => {
    const error = new Error('network failure')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetchPendingInvites.mockRejectedValue(error)

    render(WorkspaceMembersPanelContent, {
      global: { stubs: { MembersPanelContent: true } }
    })

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load pending workspace invites',
        error
      )
    )
  })

  it('handles member load failures', async () => {
    const error = new Error('network failure')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockEnsureMembersLoaded.mockRejectedValue(error)

    render(WorkspaceMembersPanelContent, {
      global: { stubs: { MembersPanelContent: true } }
    })

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load workspace members',
        error
      )
    )
  })
})
