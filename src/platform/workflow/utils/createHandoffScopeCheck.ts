import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export function createHandoffScopeCheck(workspaceId: unknown): () => boolean {
  if (!isCloud) return () => workspaceId === undefined
  const workspace = useTeamWorkspaceStore()
  return () =>
    typeof workspaceId === 'string' &&
    workspaceId.length > 0 &&
    workspace.activeWorkspaceId === workspaceId
}
