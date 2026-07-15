import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

type RoleLabelKey =
  | 'workspaceSwitcher.roleOwner'
  | 'workspaceSwitcher.roleMember'

export function roleLabelKey(role: WorkspaceRole): RoleLabelKey {
  return role === 'owner'
    ? 'workspaceSwitcher.roleOwner'
    : 'workspaceSwitcher.roleMember'
}
