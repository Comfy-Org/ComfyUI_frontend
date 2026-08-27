import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'
import {
  AGENT_PANEL_FLAG,
  FLAG_SETTLE_TIMEOUT_MS,
  createPostHogFlagSource
} from '@/workbench/extensions/agent/utils/postHogFlagSource'
import { reportError } from '@/platform/telemetry/reportError'
import { useExtensionService } from '@/services/extensionService'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const agentPanelStore = useAgentPanelStore()

    // Force-enable BEFORE any posthog work (a blocked SDK load must not
    // take local dev down); the ff: override wins in both directions.
    if (import.meta.env.MODE === 'development') {
      agentPanelStore.enabled =
        getDevOverride<boolean>(AGENT_PANEL_FLAG) ?? true
    }

    async function setupFlagGate(): Promise<void> {
      const settle = (): void => {
        agentPanelStore.gateSettled = true
      }
      // Ad blockers eat this chunk: a failed load gates off, never rejects unhandled.
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
        // featureFlags exists from the PostHog constructor, so this survives
        // init() even when setup wins the race against telemetry's bootstrap;
        // the settle timeout covers a token-less config where init never runs.
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
        reportError(error, { errorType: 'agent_flag_gate_load_failure' })
        settle()
      }
    }

    void setupFlagGate()
  }
})
