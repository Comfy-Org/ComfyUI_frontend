import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

export type RoleLabelKey =
  | 'workspaceSwitcher.roleOwner'
  | 'workspaceSwitcher.roleAdmin'
  | 'workspaceSwitcher.roleMember'

/**
 * Resolves the display label for a member's role.
 *
 * The backend role is `'owner' | 'member'`, where `'owner'` covers both the
 * workspace creator and elevated non-creators. V1 splits those visually:
 * the creator keeps "Owner"; every other `'owner'` becomes "Admin".
 */
export function roleLabelKey(
  role: WorkspaceRole,
  isOriginalOwner: boolean
): RoleLabelKey {
  if (role === 'member') return 'workspaceSwitcher.roleMember'
  return isOriginalOwner
    ? 'workspaceSwitcher.roleOwner'
    : 'workspaceSwitcher.roleAdmin'
}
