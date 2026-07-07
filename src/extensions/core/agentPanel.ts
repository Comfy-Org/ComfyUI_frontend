import { markRaw } from 'vue'

import AgentPanelRoot from '@/workbench/extensions/agent/AgentPanelRoot.vue'
import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useExtensionService } from '@/services/extensionService'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

/**
 * In-App Agent panel (FE-1187): registers the agent side panel as a sidebar tab,
 * gated by the PostHog flag `agent-in-app-experience`. Fail-closed: the tab is not
 * registered until the flag evaluates true, and it unregisters if the flag turns off.
 * The panel lives as an in-source workbench extension subtree
 * (src/workbench/extensions/agent) and renders through a host `vue` sidebar tab, so it
 * shares the host pinia and vue-i18n instances.
 */

const TAB_ID = 'agent-panel'

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  setup() {
    const sidebarTabStore = useSidebarTabStore()

    async function setupFlagGate(): Promise<void> {
      // posthog-js is initialized (or not) by the telemetry provider; an
      // uninitialized client answers isFeatureEnabled with undefined, which the
      // flag source maps to false, so the gate stays closed by default.
      const posthog = (await import('posthog-js')).default
      const source = createPostHogFlagSource(posthog)
      let registered = false
      const sync = (): void => {
        const enabled = source.isEnabled()
        if (enabled && !registered) {
          sidebarTabStore.registerSidebarTab({
            id: TAB_ID,
            type: 'vue',
            component: markRaw(AgentPanelRoot),
            icon: 'icon-[lucide--sparkles]',
            title: 'sideToolbar.agentPanel',
            tooltip: 'sideToolbar.agentPanel',
            label: 'sideToolbar.labels.agentPanel'
          })
          registered = true
        } else if (!enabled && registered) {
          sidebarTabStore.unregisterSidebarTab(TAB_ID)
          registered = false
        }
      }
      source.onChange?.(sync)
      sync()
    }

    void setupFlagGate()
  }
})
