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
    showUpgrade:
      canSubscribeSelfServe && (tier === 'STANDARD' || tier === 'CREATOR')
  }
}

export function toAgentPaywallCta(
  action: AgentPaywallAction
): 'subscribe' | 'add_credits' | 'upgrade' {
  return action === 'addCredits' ? 'add_credits' : action
}

export function toAgentPaywallReason(
  presentation: AgentPaywallPresentation
):
  | 'no_funds'
  | 'subscription_inactive'
  | 'member_cannot_pay'
  | 'sales_managed' {
  switch (presentation.kind) {
    case 'subscribed':
    case 'local':
      return 'no_funds'
    case 'subscriptionRequired':
      return 'subscription_inactive'
    case 'member':
      return 'member_cannot_pay'
    case 'salesManaged':
      return 'sales_managed'
  }
}
