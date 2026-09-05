import type { SubscriptionTier } from '@comfyorg/ingest-types'

import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

export type AgentPaywallAction = 'addCredits' | 'subscribe' | 'upgrade'

export type AgentPaywallPresentation =
  | { kind: 'subscribed'; showUpgrade: boolean }
  | { kind: 'subscriptionRequired' }
  | { kind: 'member' }
  | { kind: 'salesManaged' }
  | { kind: 'local' }

interface AgentPaywallPresentationInput {
  role: WorkspaceRole
  tier: SubscriptionTier | null
  canTopUp: boolean
  canSubscribeSelfServe: boolean
}

const TIERS_WITH_HIGHER_PERSONAL_TIER: ReadonlySet<SubscriptionTier> = new Set([
  'STANDARD',
  'CREATOR'
])

function hasHigherPersonalTier(tier: SubscriptionTier | null): boolean {
  return tier !== null && TIERS_WITH_HIGHER_PERSONAL_TIER.has(tier)
}

export const DEFAULT_AGENT_PAYWALL_PRESENTATION = {
  kind: 'subscribed',
  showUpgrade: true
} as const satisfies AgentPaywallPresentation

export function resolveAgentPaywallPresentation({
  role,
  tier,
  canTopUp,
  canSubscribeSelfServe
}: AgentPaywallPresentationInput): AgentPaywallPresentation {
  if (role === 'member') return { kind: 'member' }
  if (!canTopUp) {
    return canSubscribeSelfServe
      ? { kind: 'subscriptionRequired' }
      : { kind: 'salesManaged' }
  }
  return {
    kind: 'subscribed',
    showUpgrade: canSubscribeSelfServe && hasHigherPersonalTier(tier)
  }
}
