interface TeamWorkspaceStoreAccess {
  readonly activeWorkspaceId: string | null
  forgetRevokedActiveWorkspace(workspaceId: string): boolean
}

/** `useTeamWorkspaceStore` for `workspaceAuthStore`, which it imports. */
export let useTeamWorkspaceStoreAccess: () => TeamWorkspaceStoreAccess

/** Called by `teamWorkspaceStore` when it loads. */
export function provideTeamWorkspaceStore(
  useStore: () => TeamWorkspaceStoreAccess
): void {
  useTeamWorkspaceStoreAccess = useStore
}
