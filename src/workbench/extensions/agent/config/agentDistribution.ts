import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'

interface AgentUiComponents {
  CompactAgentComposer: Component
  AgentGraphBuildPlaybackOverlay: Component
  DockedAgentPanel: Component
}

let cachedComponents: AgentUiComponents | null | undefined

export function getAgentUiComponentsForDistribution(): AgentUiComponents | null {
  if (cachedComponents !== undefined) return cachedComponents
  if (__DISTRIBUTION__ !== 'cloud' && import.meta.env.MODE !== 'development') {
    cachedComponents = null
    return cachedComponents
  }
  cachedComponents = {
    CompactAgentComposer: defineAsyncComponent(
      () => import('../components/agent/CompactAgentComposer.vue')
    ),
    AgentGraphBuildPlaybackOverlay: defineAsyncComponent(
      () => import('../components/agent/AgentGraphBuildPlaybackOverlay.vue')
    ),
    DockedAgentPanel: defineAsyncComponent(
      () => import('../components/agent/DockedAgentPanel.vue')
    )
  }
  return cachedComponents
}
