export const AGENT_ONBOARDING_NODES = ['prompt', 'generate', 'output'] as const

export type AgentOnboardingNode = (typeof AGENT_ONBOARDING_NODES)[number]

export type AgentOnboardingState =
  | { phase: 'welcome' }
  | { phase: 'practice'; nodes: AgentOnboardingNode[] }
  | { phase: 'complete' }

export type AgentOnboardingEvent =
  | { type: 'start' }
  | { type: 'add-node'; node: AgentOnboardingNode }
  | { type: 'finish' }
  | { type: 'restart' }

export const initialAgentOnboardingState: AgentOnboardingState = {
  phase: 'welcome'
}

export function isAgentOnboardingNode(
  value: string
): value is AgentOnboardingNode {
  return AGENT_ONBOARDING_NODES.some((node) => node === value)
}

export function reduceAgentOnboardingState(
  state: AgentOnboardingState,
  event: AgentOnboardingEvent
): AgentOnboardingState {
  if (event.type === 'restart') return initialAgentOnboardingState
  if (event.type === 'start') {
    return state.phase === 'welcome' ? { phase: 'practice', nodes: [] } : state
  }
  if (state.phase !== 'practice') return state
  if (event.type === 'add-node') {
    const expectedNode = AGENT_ONBOARDING_NODES[state.nodes.length]
    return event.node === expectedNode
      ? { ...state, nodes: [...state.nodes, event.node] }
      : state
  }
  if (
    event.type === 'finish' &&
    state.nodes.length === AGENT_ONBOARDING_NODES.length
  ) {
    return { phase: 'complete' }
  }
  return state
}
