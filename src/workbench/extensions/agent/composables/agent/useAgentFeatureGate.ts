export const AGENT_PANEL_FLAG = 'agent-in-app-experience'

export interface AgentFlagSource {
  isEnabled(): boolean
  onChange?(listener: () => void): () => void
}

export interface PostHogLike {
  isFeatureEnabled(flag: string): boolean | undefined
  onFeatureFlags(listener: () => void): (() => void) | void
}

export function createPostHogFlagSource(
  posthog: PostHogLike,
  flag: string = AGENT_PANEL_FLAG
): AgentFlagSource {
  return {
    isEnabled: () => posthog.isFeatureEnabled(flag) === true,
    onChange: (listener) => {
      const unsubscribe = posthog.onFeatureFlags(listener)
      return typeof unsubscribe === 'function' ? unsubscribe : () => {}
    }
  }
}
