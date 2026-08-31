import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

interface AgentCanvasEntryMount {
  enabled: ComputedRef<boolean>
  CompactAgentComposer: Component | null
  AgentOnboardingGuide: Component | null
}

export function useAgentCanvasEntryMount(): AgentCanvasEntryMount {
  if (__DISTRIBUTION__ !== 'cloud' && import.meta.env.MODE !== 'development') {
    return {
      enabled: computed(() => false),
      CompactAgentComposer: null,
      AgentOnboardingGuide: null
    }
  }

  const agentPanelStore = useAgentPanelStore()
  return {
    enabled: computed(() => agentPanelStore.enabled),
    CompactAgentComposer: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/CompactAgentComposer.vue')
    ),
    AgentOnboardingGuide: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/AgentOnboardingGuide.vue')
    )
  }
}
