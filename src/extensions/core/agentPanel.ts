import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { registerWorkflowTabActivityTracker } from '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useExtensionService } from '@/services/extensionService'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const agentPanelStore = useAgentPanelStore()
    registerWorkflowTabActivityTracker()

    async function setupFlagGate(): Promise<void> {
      const posthog = (await import('posthog-js')).default
      const source = createPostHogFlagSource(posthog)
      const sync = (): void => {
        const forceInDev = import.meta.env.MODE === 'development'
        agentPanelStore.enabled = forceInDev || source.isEnabled()
      }
      source.onChange?.(sync)
      sync()
    }

    void setupFlagGate()
  }
})
