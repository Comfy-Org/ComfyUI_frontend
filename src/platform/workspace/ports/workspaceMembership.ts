import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

interface WorkspaceMembershipAccess {
  readonly members: readonly Pick<
    WorkspaceMember,
    'id' | 'email' | 'isOriginalOwner'
  >[]
  fetchMembers(): Promise<
    readonly Pick<WorkspaceMember, 'id' | 'email' | 'isOriginalOwner'>[]
  >
  removeMember(memberId: string): Promise<void>
}

export function useWorkspaceMembership(): WorkspaceMembershipAccess {
  return useTeamWorkspaceStore()
}
