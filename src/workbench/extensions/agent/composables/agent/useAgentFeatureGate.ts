export const AGENT_PANEL_FLAG = 'agent-in-app-experience'

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
      // Pre-init, posthog invokes the callback synchronously with
      // errorsLoading and registers nothing - that is an error report,
      // never a flags delivery, so it must not reach the listener.
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
