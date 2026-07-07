import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

export const AGENT_PANEL_FLAG = 'agent-in-app-experience'

export interface AgentFlagSource {
  // Must return false while flags are unknown/not yet loaded (fail closed).
  isEnabled(): boolean
  // Fires when flag values (re)load so the gate re-reads. Returns an unsubscribe.
  onChange?(listener: () => void): () => void
}

/**
 * Reactive fail-closed gate over an AgentFlagSource. The ref is seeded from
 * source.isEnabled() and re-read on every onChange callback; dispose unsubscribes.
 */
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

// Minimal structural surface of posthog-js. The host passes its already-initialized
// client; the panel takes NO posthog-js dependency.
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
