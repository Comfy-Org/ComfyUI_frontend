import { ref } from 'vue'

import { t } from '@/i18n'
import { createPostHogFlagSource } from '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useExtensionService } from '@/services/extensionService'
import type { ActionBarButton } from '@/types/comfy'

/**
 * In-App Agent panel (FE-1187): the panel docks on the right of the canvas (rendered by
 * GraphCanvas in the host right-side-panel slot) and opens from the top-bar "Ask Comfy
 * Agent" button — it is not a left sidebar tab (per the Figma). Gated by the PostHog flag
 * `agent-in-app-experience`, fail-closed: the button is absent and the panel unrenderable
 * until the flag evaluates true, and both hide again if the flag turns off.
 */

// Reactive mirror of the flag gate. The actionBarButtons getter reads it so the top-bar
// button shares the panel's fail-closed source; actionBarButtonStore reads getters through a
// pinia computed, so touching this ref re-derives the button list.
const flagEnabled = ref(false)

const buttons: ActionBarButton[] = [
  {
    icon: 'icon-[comfy--comfy-c]',
    label: t('agent.askComfyAgent'),
    tooltip: t('agent.askComfyAgent'),
    onClick: () => {
      useAgentPanelStore().toggle()
    }
  }
]

useExtensionService().registerExtension({
  name: 'Comfy.AgentPanel',
  get actionBarButtons() {
    return flagEnabled.value ? buttons : []
  },
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
        flagEnabled.value = enabled
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
