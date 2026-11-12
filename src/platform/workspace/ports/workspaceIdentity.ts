import type { WorkspaceWithRole } from '@comfyorg/ingest-types'

import { useCurrentUserAccess } from '@/platform/auth/currentUserAccess'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export interface WorkspaceIdentityAccess {
  readonly workspaces: readonly Pick<WorkspaceWithRole, 'id' | 'type'>[]
  readonly activeWorkspace: Pick<
    WorkspaceWithRole,
    'id' | 'name' | 'type' | 'role' | 'subscription_tier'
  > | null
  readonly activeWorkspaceId: string | null
  readonly initSettled: boolean
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
    get initSettled() {
      const { initState } = workspace
      if (initState === 'ready' || initState === 'error') return true
      if (initState !== 'uninitialized') return false
      return !useCurrentUserAccess().isLoggedIn.value
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
