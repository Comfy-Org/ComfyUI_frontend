import type { SessionClient } from '@comfyorg/account-core/session'

import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import type { WorkspaceIdentity } from '@/platform/workspace/workspaceTypes'

interface WorkspaceSessionAccess {
  readonly currentWorkspace: WorkspaceIdentity | null
  getUnifiedSessionClient(): SessionClient
  getUnifiedMintWorkspaceId(): string | undefined
}

export function useWorkspaceSession(): WorkspaceSessionAccess {
  return useWorkspaceAuthStore()
}
