import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

interface AgentCanvasEntryMount {
  enabled: ComputedRef<boolean>
  CompactAgentComposer: Component | null
  AgentGraphBuildPlaybackOverlay: Component | null
}

export function useAgentCanvasEntryMount(): AgentCanvasEntryMount {
  if (__DISTRIBUTION__ !== 'cloud') {
    return {
      enabled: computed(() => false),
      CompactAgentComposer: null,
      AgentGraphBuildPlaybackOverlay: null
    }
  }

  const agentPanelStore = useAgentPanelStore()
  return {
    enabled: computed(() => agentPanelStore.enabled),
    CompactAgentComposer: defineAsyncComponent(
      () => import('../components/agent/CompactAgentComposer.vue')
    ),
    AgentGraphBuildPlaybackOverlay: defineAsyncComponent(
      () => import('../components/agent/AgentGraphBuildPlaybackOverlay.vue')
    )
  }
}
