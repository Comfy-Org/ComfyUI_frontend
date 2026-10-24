export function accountScope(
  userId: string | null | undefined,
  workspaceId: string | null | undefined
): string | null {
  return userId && workspaceId
    ? encodeURIComponent(JSON.stringify([workspaceId, userId]))
    : null
}
