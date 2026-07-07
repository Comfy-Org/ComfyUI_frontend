import { markRaw, ref } from 'vue'

import { t } from '@/i18n'
import AgentPanelRoot from '@/workbench/extensions/agent/AgentPanelRoot.vue'
import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useExtensionService } from '@/services/extensionService'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { ActionBarButton } from '@/types/comfy'

/**
 * In-App Agent panel (FE-1187): registers the agent side panel as a sidebar tab,
 * gated by the PostHog flag `agent-in-app-experience`. Fail-closed: the tab is not
 * registered until the flag evaluates true, and it unregisters if the flag turns off.
 * The panel lives as an in-source workbench extension subtree
 * (src/workbench/extensions/agent) and renders through a host `vue` sidebar tab, so it
 * shares the host pinia and vue-i18n instances.
 */

const TAB_ID = 'agent-panel'

// Reactive mirror of the flag gate's tab-registration state. The actionBarButtons getter
// below reads this so the top-bar "Ask Comfy Agent" button shares the tab's fail-closed
// source: the button is absent until the flag registers the tab and disappears if the flag
// flips off. actionBarButtonStore reads getters through a pinia computed, so touching this
// ref re-derives the button list.
const tabRegistered = ref(false)

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[comfy--comfy-c]',
    label: t('agent.askComfyAgent'),
    tooltip: t('agent.askComfyAgent'),
    onClick: () => {
      useSidebarTabStore().toggleSidebarTab(TAB_ID)
    }
  }
]

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  get actionBarButtons() {
    return tabRegistered.value ? buttons : []
  },
  setup() {
    const sidebarTabStore = useSidebarTabStore()

    async function setupFlagGate(): Promise<void> {
      // posthog-js is initialized (or not) by the telemetry provider; an
      // uninitialized client answers isFeatureEnabled with undefined, which the
      // flag source maps to false, so the gate stays closed by default.
      const posthog = (await import('posthog-js')).default
      const source = createPostHogFlagSource(posthog)
      const sync = (): void => {
        const enabled = source.isEnabled()
        if (enabled && !tabRegistered.value) {
          sidebarTabStore.registerSidebarTab({
            id: TAB_ID,
            type: 'vue',
            component: markRaw(AgentPanelRoot),
            icon: 'icon-[comfy--comfy-c]',
            title: 'sideToolbar.agentPanel',
            tooltip: 'sideToolbar.agentPanel',
            label: 'sideToolbar.labels.agentPanel'
          })
          tabRegistered.value = true
        } else if (!enabled && tabRegistered.value) {
          sidebarTabStore.unregisterSidebarTab(TAB_ID)
          tabRegistered.value = false
        }
      }
      source.onChange?.(sync)
      sync()
    }

    void setupFlagGate()
  }
})
