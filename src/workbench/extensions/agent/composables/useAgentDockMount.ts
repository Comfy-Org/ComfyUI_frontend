import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { reportError } from '@/platform/telemetry/reportError'
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
  const { subscription, fetchStatusFresh, type } = useBillingContext()

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

  function reportBillingRefreshError(error: unknown): void {
    reportError(error, {
      errorType: 'error_refreshing_agent_billing_status',
      surface: 'agent'
    })
  }

  function refreshTransitionBaseline(identity: string, epoch: number): void {
    if (fetchStatusFresh === undefined || type.value === 'unknown') return
    const key = `${type.value}:${identity}:${epoch}`
    void agentPanelStore
      .refreshBillingStatus(
        key,
        fetchStatusFresh,
        false,
        reportBillingRefreshError
      )
      .then((adopted) => {
        if (!adopted || billingIdentity.value !== identity) return
        agentPanelStore.completeCreditTransitionRefresh(identity, epoch)
        observeFreshScopedFunds(identity)
      })
      .catch(reportBillingRefreshError)
  }

  watch(billingIdentity, (identity, previousIdentity) => {
    if (identity === previousIdentity) return
    const refreshEpoch = agentPanelStore.beginCreditTransitionRefresh(identity)
    refreshTransitionBaseline(identity, refreshEpoch)
  })

  function observeFreshScopedFunds(
    expectedIdentity = billingIdentity.value
  ): void {
    if (billingIdentity.value !== expectedIdentity) return
    const identity = expectedIdentity
    const scopedHasFunds = subscription.value?.agentScopedHasFunds
    if (scopedHasFunds === undefined) return
    const refresh = agentPanelStore.creditTransitionRefresh
    if (refresh?.identity !== identity) {
      agentPanelStore.observeAgentScopedFunds(identity, scopedHasFunds)
      return
    }
    if (
      refresh.ready &&
      agentPanelStore.claimCompletedCreditTransitionRefresh(identity)
    )
      agentPanelStore.observeAgentScopedFunds(identity, scopedHasFunds)
  }

  watch(
    [
      billingIdentity,
      () => subscription.value?.agentScopedHasFunds,
      () => agentPanelStore.creditTransitionRefresh
    ],
    () => observeFreshScopedFunds(),
    { immediate: true }
  )

  watch(type, (billingType, previousType) => {
    if (billingType === 'unknown' || billingType === previousType) return
    const refresh = agentPanelStore.creditTransitionRefresh
    if (refresh?.identity === billingIdentity.value && !refresh.ready) {
      refreshTransitionBaseline(refresh.identity, refresh.epoch)
    }
  })

  watch(
    () => agentPanelStore.isOpen,
    (isOpen, wasOpen) => {
      if (!isOpen || wasOpen || type.value !== 'workspace') return
      const identity = billingIdentity.value
      const refresh = agentPanelStore.creditTransitionRefresh
      if (refresh?.identity === identity && !refresh.ready) {
        refreshTransitionBaseline(identity, refresh.epoch)
        return
      }
      if (fetchStatusFresh === undefined) return
      void agentPanelStore
        .refreshBillingStatus(
          `${type.value}:${identity}:reopen:${agentPanelStore.panelOpenEpoch}`,
          fetchStatusFresh,
          true,
          reportBillingRefreshError
        )
        .catch(reportBillingRefreshError)
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
