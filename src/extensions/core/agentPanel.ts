import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const agentPanelStore = useAgentPanelStore()

    async function setupFlagGate(): Promise<void> {
      const posthog = (await import('posthog-js')).default
      const source = createPostHogFlagSource(posthog)
      const sync = (): void => {
        const forceInDev = import.meta.env.MODE === 'development'
        const enabled = forceInDev || source.isEnabled()
        agentPanelStore.enabled = enabled
        if (!enabled) agentPanelStore.close('flag_disabled')
      }
      source.onChange?.(sync)
      sync()
    }

    void setupFlagGate()
  }
})
