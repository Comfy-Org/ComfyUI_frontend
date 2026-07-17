import type {
  PendingInvite,
  WorkspaceMember
} from '../../platform/workspace/stores/teamWorkspaceStore'

/**
 * Storybook mock for `useTeamWorkspaceStore`.
 *
 * The real store pulls in workspace auth/network state that is unavailable in
 * Storybook. This stub resolves invites locally so the post-upgrade invite
 * block can be exercised without a backend.
 */
export const MAX_WORKSPACE_MEMBERS = 30

export function useTeamWorkspaceStore() {
  return {
    members: [] as WorkspaceMember[],
    pendingInvites: [] as PendingInvite[],
    createInvite: async (email: string): Promise<PendingInvite> => ({
      id: `inv-${email}`,
      email,
      inviteDate: new Date(0),
      expiryDate: new Date(0)
    })
  }
}
