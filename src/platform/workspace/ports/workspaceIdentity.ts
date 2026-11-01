import type { WorkspaceWithRole } from '@comfyorg/ingest-types'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export interface WorkspaceIdentityAccess {
  readonly workspaces: readonly Pick<WorkspaceWithRole, 'id' | 'type'>[]
  readonly activeWorkspace: Pick<
    WorkspaceWithRole,
    'id' | 'name' | 'type' | 'role' | 'subscription_tier'
  > | null
  readonly activeWorkspaceId: string | null
  readonly initState: 'uninitialized' | 'loading' | 'ready' | 'error'
  readonly isInPersonalWorkspace: boolean
  readonly workspaceTransitionGeneration: number
  readonly identityGeneration: number
}

export function useWorkspaceIdentity(): WorkspaceIdentityAccess {
  const workspace = useTeamWorkspaceStore()
  return {
    get workspaces() {
      return workspace.workspaces
    },
    get activeWorkspace() {
      return workspace.activeWorkspace
    },
    get activeWorkspaceId() {
      return workspace.activeWorkspaceId
    },
    get initState() {
      return workspace.initState
    },
    get isInPersonalWorkspace() {
      return workspace.isInPersonalWorkspace
    },
    get workspaceTransitionGeneration() {
      return workspace.workspaceTransitionGeneration
    },
    get identityGeneration() {
      return workspace.identityGeneration
    }
  }
}
