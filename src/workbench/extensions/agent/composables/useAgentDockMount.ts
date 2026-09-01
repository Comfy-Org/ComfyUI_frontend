import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

interface AgentDockMount {
  docked: ComputedRef<boolean>
  DockedAgentPanel: Component | null
}

/**
 * The one distribution seam for the dock mounts. The literal comparison is
 * what dead-code-eliminates the store and both panel component chunks from
 * OSS builds. Development keeps the mounts available for local Agent UI
 * testing; production only requests the async chunks in the cloud build.
 */
export function useAgentDockMount(): AgentDockMount {
  if (__DISTRIBUTION__ !== 'cloud' && import.meta.env.MODE !== 'development') {
    return { docked: computed(() => false), DockedAgentPanel: null }
  }
  const agentPanelStore = useAgentPanelStore()
  return {
    docked: computed(() => agentPanelStore.enabled && agentPanelStore.isOpen),
    DockedAgentPanel: defineAsyncComponent(
      () => import('../components/agent/DockedAgentPanel.vue')
    )
  }
}
