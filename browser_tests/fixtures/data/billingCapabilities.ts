import type {
  BillingCapabilities,
  BillingCapabilitiesResponse
} from '@comfyorg/ingest-types'

import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

export function createBillingCapabilities(
  workspaceId: string,
  overrides: Partial<BillingCapabilities> = {}
): BillingCapabilitiesResponse {
  return {
    resolved_for: {
      user_id: 'e2e-user',
      workspace_id: workspaceId
    },
    capabilities: {
      can_cancel: false,
      can_change_seats: false,
      can_downgrade_to_personal: false,
      can_invite_members: false,
      can_reactivate: false,
      can_subscribe_self_serve: true,
      can_top_up: true,
      ...overrides
    },
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    revision: 1,
    // Far-future expiry so the snapshot never goes stale mid-test.
    expires_at: '2099-01-01T00:00:00Z'
  }
}

/**
 * The capability set the server resolves for `ws`: management actions belong
 * to owners, and downgrade-to-personal only exists on a team workspace.
 *
 * `resolved_for.workspace_id` must match the active workspace or the client
 * discards the read as out-of-scope and falls back to every capability false.
 */
export function createWorkspaceBillingCapabilities(
  ws: WorkspaceWithRole,
  overrides: Partial<BillingCapabilities> = {}
): BillingCapabilitiesResponse {
  const isOwner = ws.role === 'owner'
  return createBillingCapabilities(ws.id, {
    can_cancel: isOwner,
    can_change_seats: isOwner,
    can_downgrade_to_personal: isOwner && ws.type === 'team',
    can_invite_members: isOwner,
    can_reactivate: isOwner,
    can_subscribe_self_serve: isOwner,
    can_top_up: isOwner,
    ...overrides
  })
}
