import type {
  BillingCapabilities,
  BillingCapabilitiesResponse
} from '@comfyorg/ingest-types'

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
