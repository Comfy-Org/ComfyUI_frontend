import type { CapabilitiesSnapshot } from '@comfyorg/account-core/billing'

import type { BillingCapabilitiesResponse } from '@/platform/workspace/api/workspaceApi'

/**
 * The SDK's cached capabilities snapshot in the shape the capabilities
 * composable already holds: the scope it was resolved for and the instant the
 * SDK stops serving it, which is the instant the composable would refetch.
 */
export function projectBillingCapabilities(
  snapshot: CapabilitiesSnapshot
): BillingCapabilitiesResponse {
  return {
    capabilities: snapshot.capabilities,
    expires_at: new Date(snapshot.freshUntil).toISOString(),
    resolved_for: {
      user_id: snapshot.scope.userId,
      workspace_id: snapshot.scope.workspaceId
    },
    revision: snapshot.revision,
    rollout_defaults_applied: snapshot.rolloutDefaultsApplied
  }
}
