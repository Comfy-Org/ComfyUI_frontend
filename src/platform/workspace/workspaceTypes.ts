/**
 * Identifier for a workspace.
 *
 * Backed by the `id` field returned by the workspace REST API. This alias
 * names that primitive at use sites (api, types, stores) without changing
 * structural typing.
 */
export type WorkspaceId = string

/**
 * Identifier for a pending workspace invite.
 *
 * Backed by the `id` field on `PendingInvite`. This alias names that
 * primitive at use sites without changing structural typing.
 */
export type WorkspaceInviteId = string
export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface WorkspaceWithRole {
  id: WorkspaceId
  name: string
  type: 'personal' | 'team'
  role: WorkspaceRole
}
