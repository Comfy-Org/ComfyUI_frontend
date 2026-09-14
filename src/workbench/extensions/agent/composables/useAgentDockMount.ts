import type { Component, ComputedRef, Ref } from 'vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

interface AgentDockMount {
  docked: ComputedRef<boolean>
  /**
   * Latches on the first dock and never clears, so the panel stays mounted
   * across closes and can play its own leave transition. Before that first
   * open it is false, which is what keeps the chunk unrequested.
   */
  everDocked: Ref<boolean>
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
    return {
      docked: computed(() => false),
      everDocked: ref(false),
      DockedAgentPanel: null
    }
  }
  const agentPanelStore = useAgentPanelStore()
  const docked = computed(() => agentPanelStore.isVisible)
  const everDocked = ref(false)
  watch(
    docked,
    (value) => {
      if (value) everDocked.value = true
    },
    { immediate: true }
  )

  return {
    docked,
    everDocked,
    DockedAgentPanel: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    )
  }
}
