import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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
  if (__DISTRIBUTION__ !== 'cloud' && import.meta.env.MODE !== 'development') {
    return { docked: computed(() => false), DockedAgentPanel: null }
  }
  const agentPanelStore = useAgentPanelStore()
  return {
    docked: computed(() => agentPanelStore.enabled && agentPanelStore.isOpen),
    DockedAgentPanel: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    )
  }
}
