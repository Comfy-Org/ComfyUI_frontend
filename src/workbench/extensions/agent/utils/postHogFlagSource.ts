export const AGENT_PANEL_FLAG = 'agent-in-app-experience'

/** Settle budget for the no-delivery path (a config with no posthog project token, where init never runs). */
export const FLAG_SETTLE_TIMEOUT_MS = 5000

export interface AgentFlagSource {
  isEnabled(): boolean
  onChange?(listener: () => void): () => void
}

export interface PostHogLike {
  isFeatureEnabled(flag: string): boolean | undefined
  onFeatureFlags(
    listener: (
      flags?: string[],
      variants?: Record<string, unknown>,
      context?: { errorsLoading?: boolean }
    ) => void
  ): (() => void) | void
}

export function createPostHogFlagSource(
  posthog: PostHogLike,
  flag: string = AGENT_PANEL_FLAG
): AgentFlagSource {
  return {
    isEnabled: () => posthog.isFeatureEnabled(flag) === true,
    onChange: (listener) => {
      // Pre-init errorsLoading is an error report, not a delivery - never forwarded.
      const unsubscribe = posthog.onFeatureFlags(
        (_flags, _variants, context) => {
          if (context?.errorsLoading) return
          listener()
        }
      )
      return typeof unsubscribe === 'function' ? unsubscribe : () => {}
    }
  }
}
