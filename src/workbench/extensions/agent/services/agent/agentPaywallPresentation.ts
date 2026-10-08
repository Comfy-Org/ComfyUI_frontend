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
  | { kind: 'unresolved' }

interface AgentPaywallPresentationInput {
  distribution: 'cloud' | 'local'
  role: WorkspaceRole | undefined
  tier: SubscriptionTier | null
  canTopUp: boolean
  canSubscribeSelfServe: boolean
}

/**
 * The capability read settled without an answer we can act on. Degraded, not
 * transient — so a server-supplied diagnostic is the most useful body we have
 * and the card renders it in preference to generic localized copy.
 */
export const DEFAULT_AGENT_PAYWALL_PRESENTATION = {
  kind: 'unavailable'
} as const satisfies AgentPaywallPresentation

/**
 * The capability read has not produced an answer yet. Distinct from
 * `unavailable` so the card does not render an always-English server
 * diagnostic for the duration of a slow `/api/billing/capabilities`, then swap
 * it for localized copy inside a `role="alert"` region — which re-announces
 * the card with different content and inverts the point of localizing it.
 */
export const UNRESOLVED_AGENT_PAYWALL_PRESENTATION = {
  kind: 'unresolved'
} as const satisfies AgentPaywallPresentation

const AGENT_PAYWALL_REASONS = {
  subscribed: 'no_funds',
  local: 'no_funds',
  subscriptionRequired: 'subscription_inactive',
  member: 'member_cannot_pay',
  salesManaged: 'sales_managed',
  unavailable: 'unknown',
  unresolved: 'unknown'
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
