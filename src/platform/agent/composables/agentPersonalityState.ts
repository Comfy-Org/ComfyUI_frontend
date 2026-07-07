import { reactive, readonly } from 'vue'

export interface AgentHoverParams {
  scale: number
  stiffness: number
  damping: number
}

export interface AgentIdleParams {
  amplitude: number
  period: number
}

interface AgentBorderShimmerParams {
  speed: number
  spread: number
  opacity: number
}

export interface AgentPersonalityParams {
  hover: AgentHoverParams
  idle: AgentIdleParams
  shimmer: AgentBorderShimmerParams
}

const DEFAULT_PERSONALITY: AgentPersonalityParams = {
  hover: {
    scale: 1.06,
    stiffness: 260,
    damping: 20
  },
  idle: {
    amplitude: 0.015,
    period: 4
  },
  shimmer: {
    speed: 1.8,
    spread: 20,
    opacity: 0.9
  }
}

const state = reactive<AgentPersonalityParams>({
  hover: { ...DEFAULT_PERSONALITY.hover },
  idle: { ...DEFAULT_PERSONALITY.idle },
  shimmer: { ...DEFAULT_PERSONALITY.shimmer }
})

/** Read-only tunable params for the agent's hover/idle motion and border shimmer. */
export function useAgentPersonality() {
  return readonly(state)
}

/** Mirrors live values from the dev-only tuning panel into the shared state. */
export function setAgentPersonality(values: AgentPersonalityParams): void {
  Object.assign(state.hover, values.hover)
  Object.assign(state.idle, values.idle)
  Object.assign(state.shimmer, values.shimmer)
}
