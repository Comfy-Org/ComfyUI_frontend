import { computed, ref } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function useAgentEntry() {
  const agentPanelStore = useAgentPanelStore()
  const { withConsent, isChecking } = useAgentConsent()
  const isOpeningAgent = ref(false)

  const showAgentEntry = computed(
    () =>
      agentPanelStore.enabled && !(agentPanelStore.isOpen && isChecking.value)
  )

  const isPanelVisible = computed(() => agentPanelStore.isVisible)

  async function onAgentEntryClick(): Promise<void> {
    if (isOpeningAgent.value) return
    isOpeningAgent.value = true

    try {
      if (agentPanelStore.isVisible) {
        useTelemetry()?.trackAgentEntryButtonClicked({
          resulting_state: 'closed'
        })
        agentPanelStore.toggle()
        return
      }

      agentPanelStore.suppressRestoredOpen()
      await withConsent(() => {
        if (!agentPanelStore.enabled) return
        useTelemetry()?.trackAgentEntryButtonClicked({
          resulting_state: 'opened'
        })
        agentPanelStore.open()
      })
    } finally {
      isOpeningAgent.value = false
    }
  }

  return { showAgentEntry, isPanelVisible, onAgentEntryClick }
}
