import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { reconcilePersistedDocId } from '../crdt/persistedDocId'

interface AgentDockMount {
  docked: ComputedRef<boolean>
  DockedAgentPanel: Component | null
}

/**
 * The one distribution seam for the dock mounts. The literal comparison is
 * what dead-code-eliminates the store and both panel component chunks from
 * OSS builds; on cloud the async component is only requested once the gate
 * enables and opens the panel, so a flag-off session fetches no agent chunk.
 */
export function useAgentDockMount(): AgentDockMount {
  if (__DISTRIBUTION__ !== 'cloud') {
    return { docked: computed(() => false), DockedAgentPanel: null }
  }
  reconcilePersistedDocId()
  const agentPanelStore = useAgentPanelStore()
  return {
    docked: computed(() => agentPanelStore.enabled && agentPanelStore.isOpen),
    DockedAgentPanel: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    )
  }
}
