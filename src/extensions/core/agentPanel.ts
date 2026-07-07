import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useExtensionService } from '@/services/extensionService'

/**
 * In-App Agent panel (FE-1187): the panel docks as a full-viewport-height right column
 * (the splitter overlay's agent-panel slot) and opens from the workflow-tab-bar "Ask
 * Comfy Agent" button. Gated by the PostHog flag `agent-in-app-experience`, fail-closed:
 * the button is absent and the panel unreachable until the flag evaluates true, and both
 * hide again (closing an open panel) if the flag turns off.
 */

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const agentPanelStore = useAgentPanelStore()

    async function setupFlagGate(): Promise<void> {
      // posthog-js is initialized (or not) by the telemetry provider; an
      // uninitialized client answers isFeatureEnabled with undefined, which the
      // flag source maps to false, so the gate stays closed by default.
      const posthog = (await import('posthog-js')).default
      const source = createPostHogFlagSource(posthog)
      const sync = (): void => {
        // The dev server shows the panel without the PostHog flag (which is scoped to a cloud
        // project the dev build may not read); test and production builds still gate on it.
        const forceInDev = import.meta.env.MODE === 'development'
        const enabled = forceInDev || source.isEnabled()
        agentPanelStore.enabled = enabled
        // Fail-closed: a flag flip-off also closes an open panel.
        if (!enabled) agentPanelStore.close()
      }
      source.onChange?.(sync)
      sync()
    }

    void setupFlagGate()
  }
})
