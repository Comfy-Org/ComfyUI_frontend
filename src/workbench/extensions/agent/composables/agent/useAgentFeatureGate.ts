import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

export const AGENT_PANEL_FLAG = 'agent-in-app-experience'

export interface AgentFlagSource {
  // Must return false while flags are unknown/not yet loaded (fail closed).
  isEnabled(): boolean
  onChange?(listener: () => void): () => void
}

export function useAgentFeatureGate(source: AgentFlagSource): {
  enabled: Readonly<Ref<boolean>>
  dispose: () => void
} {
  const enabled = ref(source.isEnabled())
  const unsubscribe = source.onChange?.(() => {
    enabled.value = source.isEnabled()
  })
  return {
    enabled: readonly(enabled),
    dispose: () => unsubscribe?.()
  }
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
    // undefined = flags not loaded -> fail closed.
    isEnabled: () => posthog.isFeatureEnabled(flag) === true,
    onChange: (listener) => {
      const unsubscribe = posthog.onFeatureFlags(listener)
      return typeof unsubscribe === 'function' ? unsubscribe : () => {}
    }
  }
}
