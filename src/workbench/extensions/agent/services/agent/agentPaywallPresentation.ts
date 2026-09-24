import type { SubscriptionTier } from '@comfyorg/ingest-types'

import type {
  AgentPaywallCta,
  AgentPaywallReason
} from '@/platform/telemetry/types'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

export type AgentPaywallAction = 'addCredits' | 'subscribe' | 'upgrade'

export type AgentPaywallPresentation =
  | { kind: 'subscribed'; showUpgrade: boolean }
  | { kind: 'subscriptionRequired' }
  | { kind: 'member' }
  | { kind: 'salesManaged' }
  | { kind: 'local' }
  | { kind: 'unavailable' }

interface AgentPaywallPresentationInput {
  distribution: 'cloud' | 'local'
  role: WorkspaceRole | undefined
  tier: SubscriptionTier | null
  canTopUp: boolean
  canSubscribeSelfServe: boolean
}

export const DEFAULT_AGENT_PAYWALL_PRESENTATION = {
  kind: 'unavailable'
} as const satisfies AgentPaywallPresentation

const AGENT_PAYWALL_REASONS = {
  subscribed: 'no_funds',
  local: 'no_funds',
  subscriptionRequired: 'subscription_inactive',
  member: 'member_cannot_pay',
  salesManaged: 'sales_managed',
  unavailable: 'unknown'
} satisfies Record<AgentPaywallPresentation['kind'], AgentPaywallReason>

export function toAgentPaywallReason(
  presentation: AgentPaywallPresentation
): AgentPaywallReason {
  return AGENT_PAYWALL_REASONS[presentation.kind]
}

const AGENT_PAYWALL_CTAS = {
  addCredits: 'add_credits',
  subscribe: 'subscribe',
  upgrade: 'upgrade'
} satisfies Record<AgentPaywallAction, AgentPaywallCta>

export function toAgentPaywallCta(action: AgentPaywallAction): AgentPaywallCta {
  return AGENT_PAYWALL_CTAS[action]
}

export function resolveAgentPaywallPresentation({
  distribution,
  role,
  tier,
  canTopUp,
  canSubscribeSelfServe
}: AgentPaywallPresentationInput): AgentPaywallPresentation {
  if (distribution === 'local') return { kind: 'local' }
  if (role === undefined) return DEFAULT_AGENT_PAYWALL_PRESENTATION
  if (role === 'member' && !canTopUp) return { kind: 'member' }
  if (!canTopUp) {
    return canSubscribeSelfServe
      ? { kind: 'subscriptionRequired' }
      : { kind: 'salesManaged' }
  }
  return {
    kind: 'subscribed',
    showUpgrade:
      canSubscribeSelfServe && (tier === 'STANDARD' || tier === 'CREATOR')
  }
}
