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
  if (!providedUseTeamWorkspaceStore)
    throw new TypeError('teamWorkspaceStore has not provided itself')

  return providedUseTeamWorkspaceStore()
}
