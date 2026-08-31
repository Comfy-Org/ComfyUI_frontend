import type { Component, ComputedRef } from 'vue'
import { computed } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { getAgentUiComponentsForDistribution } from '../config/agentDistribution'

interface AgentDockMount {
  docked: ComputedRef<boolean>
  DockedAgentPanel: Component | null
}

/**
 * The production distribution seam for the dock mounts. The literal
 * comparison dead-code-eliminates both panel component chunks from OSS builds.
 * Development keeps the mount available for local Agent UI testing.
 */
export function useAgentDockMount(): AgentDockMount {
  const components = getAgentUiComponentsForDistribution()
  if (components === null) {
    return { docked: computed(() => false), DockedAgentPanel: null }
  }
  const agentPanelStore = useAgentPanelStore()
  return {
    docked: computed(() => agentPanelStore.enabled && agentPanelStore.isOpen),
    DockedAgentPanel: components.DockedAgentPanel
  }
}
