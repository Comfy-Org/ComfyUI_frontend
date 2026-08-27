import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'
import {
  AGENT_PANEL_FLAG,
  FLAG_SETTLE_TIMEOUT_MS,
  createPostHogFlagSource
} from '@/workbench/extensions/agent/utils/postHogFlagSource'
import { useExtensionService } from '@/services/extensionService'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const agentPanelStore = useAgentPanelStore()

    // Dev builds force-enable BEFORE any posthog work so a blocked SDK load
    // cannot take local development down with it; the ff: localStorage
    // override wins in both directions so the flag-off path stays
    // reproducible locally.
    if (import.meta.env.MODE === 'development') {
      agentPanelStore.enabled =
        getDevOverride<boolean>(AGENT_PANEL_FLAG) ?? true
    }

    async function setupFlagGate(): Promise<void> {
      const settle = (): void => {
        agentPanelStore.gateSettled = true
      }
      // posthog-js is a lazy chunk and is commonly blocked by ad blockers; a failed
      // load must leave the panel gated off rather than surface as an unhandled rejection.
      try {
        const posthog = (await import('posthog-js')).default
        const source = createPostHogFlagSource(posthog)
        const sync = (): void => {
          const devOverride =
            import.meta.env.MODE === 'development'
              ? getDevOverride<boolean>(AGENT_PANEL_FLAG)
              : undefined
          const forceInDev = import.meta.env.MODE === 'development'
          agentPanelStore.enabled =
            devOverride ?? (forceInDev || source.isEnabled())
        }
        // The full posthog bundle constructs its featureFlags extension in
        // the PostHog constructor ("so they're available before init()"), so
        // this subscription registers and survives init() even when setup
        // wins the race against telemetry's posthog bootstrap. The settle
        // timeout covers the one path with no delivery at all: a config
        // without a posthog project token, where init never runs.
        source.onChange?.(() => {
          sync()
          settle()
        })
        sync()
        setTimeout(settle, FLAG_SETTLE_TIMEOUT_MS)
      } catch (error) {
        console.error(
          '[Comfy.AgentPanel] feature-flag gate failed to load',
          error
        )
        settle()
      }
    }

    void setupFlagGate()
  }
})
