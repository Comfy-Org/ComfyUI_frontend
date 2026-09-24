import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentWorkflowTabBindingStore } from '@/workbench/extensions/agent/stores/agent/agentWorkflowTabBindingStore'

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
  // The local agent harness (VITE_AGENT_STANDALONE) mounts the panel in any
  // distribution; production keeps it cloud-only.
  if (
    __DISTRIBUTION__ !== 'cloud' &&
    import.meta.env.VITE_AGENT_STANDALONE !== 'true'
  ) {
    return { docked: computed(() => false), DockedAgentPanel: null }
  }
  const agentPanelStore = useAgentPanelStore()
  // Tab bookkeeping has to outlive the panel. Instantiating the binding store
  // installs its open-tabs watcher, and that watcher is what archives the
  // graph of a bound unsaved tab as it closes. The panel mounts only once the
  // user opens it — often after those tabs were already closed, sometimes
  // never — so waiting for it would lose exactly the graphs chat needs back.
  useAgentWorkflowTabBindingStore()
  return {
    docked: computed(() => agentPanelStore.isVisible),
    DockedAgentPanel: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    )
  }
}
