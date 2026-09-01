import type { Component, ComputedRef } from 'vue'
import { computed } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { getAgentUiComponentsForDistribution } from '../config/agentDistribution'
import { agentGraphBuildPlaybackState } from '../services/agent/agentGraphBuildPlayback'

interface AgentCanvasEntryMount {
  enabled: ComputedRef<boolean>
  graphBuildActive: ComputedRef<boolean>
  CompactAgentComposer: Component | null
  AgentGraphBuildPlaybackOverlay: Component | null
}

export function useAgentCanvasEntryMount(): AgentCanvasEntryMount {
  const components = getAgentUiComponentsForDistribution()
  if (components === null) {
    return {
      enabled: computed(() => false),
      graphBuildActive: computed(() => false),
      CompactAgentComposer: null,
      AgentGraphBuildPlaybackOverlay: null
    }
  }

  const agentPanelStore = useAgentPanelStore()
  return {
    enabled: computed(() => agentPanelStore.enabled),
    graphBuildActive: computed(
      () =>
        agentGraphBuildPlaybackState.value.phase === 'playing' ||
        agentGraphBuildPlaybackState.value.phase === 'paused'
    ),
    CompactAgentComposer: components.CompactAgentComposer,
    AgentGraphBuildPlaybackOverlay: components.AgentGraphBuildPlaybackOverlay
  }
}
