import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const agentPanelStore = useAgentPanelStore()

    async function setupFlagGate(): Promise<void> {
      // posthog-js is a lazy chunk and is commonly blocked by ad blockers; a failed
      // load must leave the panel gated off rather than surface as an unhandled rejection.
      try {
        const posthog = (await import('posthog-js')).default
        const source = createPostHogFlagSource(posthog)
        const sync = (): void => {
          const forceInDev = import.meta.env.MODE === 'development'
          agentPanelStore.enabled = forceInDev || source.isEnabled()
        }
        source.onChange?.(sync)
        sync()
      } catch (error) {
        console.error(
          '[Comfy.AgentPanel] feature-flag gate failed to load',
          error
        )
      }
    }

    void setupFlagGate()
  }
})
