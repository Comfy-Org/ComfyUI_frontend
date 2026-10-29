import { assert } from '@comfyorg/shared-frontend-utils/assert'

interface TeamWorkspaceStoreAccess {
  readonly activeWorkspaceId: string | null
  forgetRevokedActiveWorkspace(workspaceId: string): boolean
}

let providedUseTeamWorkspaceStore: (() => TeamWorkspaceStoreAccess) | undefined

/** Called by `teamWorkspaceStore` when it loads. */
export function provideTeamWorkspaceStore(
  useStore: () => TeamWorkspaceStoreAccess
): void {
  providedUseTeamWorkspaceStore = useStore
}

/** `useTeamWorkspaceStore` for `workspaceAuthStore`, which it imports. */
export function useTeamWorkspaceStoreAccess(): TeamWorkspaceStoreAccess {
  assert(
    providedUseTeamWorkspaceStore,
    'teamWorkspaceStore has not provided itself'
  )
  return providedUseTeamWorkspaceStore()
}
