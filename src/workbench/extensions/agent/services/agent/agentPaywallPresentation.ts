import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'

export type AgentPaywallAction = 'addCredits' | 'subscribe' | 'upgrade'

export type AgentPaywallPresentation =
  | { kind: 'subscribed'; showUpgrade: boolean }
  | { kind: 'subscriptionRequired' }
  | { kind: 'member' }
  | { kind: 'salesManaged' }
  | { kind: 'local' }

interface AgentPaywallPresentationInput {
  distribution: 'cloud' | 'local'
  role: WorkspaceRole
  canTopUp: boolean
  canSubscribeSelfServe: boolean
}

export const DEFAULT_AGENT_PAYWALL_PRESENTATION = {
  kind: 'subscribed',
  showUpgrade: true
} as const satisfies AgentPaywallPresentation

export function resolveAgentPaywallPresentation({
  distribution,
  role,
  canTopUp,
  canSubscribeSelfServe
}: AgentPaywallPresentationInput): AgentPaywallPresentation {
  if (role === 'member') return { kind: 'member' }
  if (distribution === 'local') return { kind: 'local' }
  if (!canTopUp) {
    return canSubscribeSelfServe
      ? { kind: 'subscriptionRequired' }
      : { kind: 'salesManaged' }
  }
  return {
    kind: 'subscribed',
    showUpgrade: canSubscribeSelfServe
  }
}
