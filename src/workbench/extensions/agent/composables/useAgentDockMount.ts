import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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
  const { subscription } = useBillingContext()

  // This composable is owned by the persistent graph/linear hosts, unlike the
  // dock component, which is unmounted whenever the panel closes. Keep the
  // exhaustion episode synchronized here so funds recovery while closed can
  // re-arm the next impression.
  watch(
    () => subscription.value?.agentHasFunds,
    (hasFunds) => {
      if (hasFunds === true) agentPanelStore.reportedExhaustionIdentity = null
    },
    { immediate: true }
  )

  return {
    docked: computed(() => agentPanelStore.isVisible),
    DockedAgentPanel: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    )
  }
}
