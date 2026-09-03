import type { Distribution } from '@/platform/distribution/types'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

export type AgentPaywallPresentation =
  | { kind: 'unknown' }
  | { kind: 'topUpAvailable' }
  | { kind: 'subscriptionRequired' }
  | { kind: 'member' }
  | { kind: 'salesManaged' }
  | { kind: 'local' }

interface AgentPaywallPresentationInput {
  distribution: Distribution
  role: WorkspaceRole
  hasAuthoritativeCapabilities: boolean
  canTopUp: boolean
  canSubscribeSelfServe: boolean
}

/**
 * Maps the server-owned billing capabilities to the Agent out-of-credit UI.
 *
 * Cloud owners follow the capability pair. Workspace members cannot purchase
 * for their owner, while Desktop and localhost users may have no subscription
 * at all and therefore retain the local add-credits path.
 */
export function resolveAgentPaywallPresentation({
  distribution,
  role,
  hasAuthoritativeCapabilities,
  canTopUp,
  canSubscribeSelfServe
}: AgentPaywallPresentationInput): AgentPaywallPresentation {
  if (distribution !== 'cloud') return { kind: 'local' }
  if (role === 'member') return { kind: 'member' }
  if (!hasAuthoritativeCapabilities) return { kind: 'unknown' }
  if (!canTopUp) {
    return canSubscribeSelfServe
      ? { kind: 'subscriptionRequired' }
      : { kind: 'salesManaged' }
  }
  return { kind: 'topUpAvailable' }
}
