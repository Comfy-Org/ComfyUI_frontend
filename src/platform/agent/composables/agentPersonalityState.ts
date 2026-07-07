import { reactive, readonly } from 'vue'

export interface AgentShaderParams {
  hueBase: number
  hueRange: number
  speed: number
  scale: number
  intensity: number
  glow: number
}

export interface AgentHoverParams {
  scale: number
  stiffness: number
  damping: number
}

export interface AgentIdleParams {
  amplitude: number
  period: number
}

export interface AgentBorderShimmerParams {
  speed: number
  spread: number
  opacity: number
}

export interface AgentPersonalityParams {
  shader: AgentShaderParams
  hover: AgentHoverParams
  idle: AgentIdleParams
  shimmer: AgentBorderShimmerParams
}

const DEFAULT_PERSONALITY: AgentPersonalityParams = {
  shader: {
    hueBase: 45,
    hueRange: 40,
    speed: 0.6,
    scale: 3,
    intensity: 0.8,
    glow: 0.5
  },
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
  shader: { ...DEFAULT_PERSONALITY.shader },
  hover: { ...DEFAULT_PERSONALITY.hover },
  idle: { ...DEFAULT_PERSONALITY.idle },
  shimmer: { ...DEFAULT_PERSONALITY.shimmer }
})

/** Read-only tunable params for the agent's shader background and hover/idle motion. */
export function useAgentPersonality() {
  return readonly(state)
}

/** Mirrors live values from the dev-only tuning panel into the shared state. */
export function setAgentPersonality(values: AgentPersonalityParams): void {
  Object.assign(state.shader, values.shader)
  Object.assign(state.hover, values.hover)
  Object.assign(state.idle, values.idle)
  Object.assign(state.shimmer, values.shimmer)
}
