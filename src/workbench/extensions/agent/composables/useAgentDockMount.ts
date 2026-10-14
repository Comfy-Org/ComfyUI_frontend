import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useBillingIdentity } from './useBillingIdentity'

interface AgentDockMount {
  docked: ComputedRef<boolean>
  DockedAgentPanel: Component
}

/**
 * The dock mounts for the graph and linear hosts. The async component is only
 * requested once the gate enables and opens the panel, so a flag-off session
 * (on cloud, or a ComfyUI without its agent) fetches no agent chunk.
 */
export function useAgentDockMount(): AgentDockMount {
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

  const billingIdentity = useBillingIdentity()

  watch(
    [billingIdentity, () => subscription.value?.agentScopedHasFunds],
    ([identity, scopedHasFunds]) => {
      if (scopedHasFunds === undefined) return
      agentPanelStore.observeAgentScopedFunds(identity, scopedHasFunds)
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
