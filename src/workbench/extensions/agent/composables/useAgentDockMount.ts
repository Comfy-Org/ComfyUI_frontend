import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useBillingIdentity } from './useBillingIdentity'

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
  const { subscription, fetchStatus, type } = useBillingContext()

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
  let identityRefreshEpoch = 0
  let refreshingIdentity: string | null = null

  watch(billingIdentity, (identity, previousIdentity) => {
    if (identity === previousIdentity) return
    const refreshEpoch = ++identityRefreshEpoch
    refreshingIdentity = identity
    void fetchStatus()
      .then(() => {
        if (
          refreshEpoch !== identityRefreshEpoch ||
          billingIdentity.value !== identity
        )
          return
        refreshingIdentity = null
        const scopedHasFunds = subscription.value?.agentScopedHasFunds
        if (scopedHasFunds !== undefined)
          agentPanelStore.observeAgentScopedFunds(identity, scopedHasFunds)
      })
      .catch(() => {
        if (refreshEpoch === identityRefreshEpoch) refreshingIdentity = null
      })
  })

  watch(
    [billingIdentity, () => subscription.value?.agentScopedHasFunds],
    ([identity, scopedHasFunds]) => {
      if (scopedHasFunds === undefined || refreshingIdentity === identity)
        return
      agentPanelStore.observeAgentScopedFunds(identity, scopedHasFunds)
    },
    { immediate: true }
  )

  watch(
    () => agentPanelStore.isOpen,
    (isOpen, wasOpen) => {
      if (!isOpen || wasOpen || type.value !== 'workspace') return
      void fetchStatus().catch(() => undefined)
    }
  )

  return {
    docked: computed(() => agentPanelStore.isVisible),
    DockedAgentPanel: defineAsyncComponent(
      () =>
        import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    )
  }
}
