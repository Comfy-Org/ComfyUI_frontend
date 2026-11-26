import { reportError } from '@comfyorg/telemetry/reportError'
import type { Component, ComputedRef } from 'vue'
import { computed, defineAsyncComponent, watch } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelRenderStore } from '@/workbench/extensions/agent/stores/agent/agentPanelRenderStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useBillingIdentity } from './useBillingIdentity'

interface AgentDockMount {
  docked: ComputedRef<boolean>
  DockedAgentPanel: Component
}

export function useAgentDockMount(): AgentDockMount {
  const agentPanelStore = useAgentPanelStore()
  useAgentPanelRenderStore()
  const { subscription, fetchStatus, fetchStatusFresh, type } =
    useBillingContext()

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

  const consentStore = useAgentConsentStore()
  const billingIdentity = useBillingIdentity()

  function reportBillingRefreshError(error: unknown): void {
    reportError(error, {
      errorType: 'error_refreshing_agent_billing_status',
      surface: 'agent'
    })
  }

  function acceptanceRefreshKey(
    billingType: string,
    identity: string,
    acceptances: number
  ): string {
    return `${billingType}:${identity}:acceptance:${acceptances}`
  }

  watch(
    () => consentStore.confirmedAcceptances,
    (count) => {
      if (!count || count <= agentPanelStore.billingRefreshedAcceptances) return
      agentPanelStore.billingRefreshedAcceptances = count
      // Routing not known yet: `fetchStatus` owes the fresh read until it is,
      // which `fetchStatusFresh` does not do. There is no panel open to share
      // with in that window either, so keep the direct call.
      if (fetchStatusFresh === undefined || type.value === 'unknown') {
        void fetchStatus({ fresh: true }).catch(reportBillingRefreshError)
        return
      }
      // Otherwise go through the shared refresh registry, so this read is
      // ordered against the other fresh reads rather than racing them, and
      // hand it to the panel open that this acceptance is about to trigger.
      const identity = billingIdentity.value
      agentPanelStore.recordAcceptanceBillingRefresh(type.value, identity)
      void agentPanelStore
        .refreshBillingStatus(
          acceptanceRefreshKey(type.value, identity, count),
          fetchStatusFresh,
          false,
          reportBillingRefreshError
        )
        .catch(reportBillingRefreshError)
    },
    { immediate: true, flush: 'sync' }
  )

  function adoptTransitionBaseline(
    billingType: string,
    identity: string,
    epoch: number
  ): void {
    if (billingIdentity.value !== identity || type.value !== billingType) return
    if (!agentPanelStore.completeCreditTransitionRefresh(identity, epoch))
      return
    observeFreshScopedFunds(identity)
  }

  function refreshTransitionBaseline(identity: string, epoch: number): void {
    if (fetchStatusFresh === undefined || type.value === 'unknown') return
    const billingType = type.value
    const key = `${billingType}:${identity}:${epoch}`
    void agentPanelStore
      .refreshBillingStatus(
        key,
        fetchStatusFresh,
        false,
        reportBillingRefreshError,
        () => adoptTransitionBaseline(billingType, identity, epoch)
      )
      .then((adopted) => {
        if (adopted) adoptTransitionBaseline(billingType, identity, epoch)
      }, reportBillingRefreshError)
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
      // The acceptance that opened this panel already issued a fresh read, so
      // that read is this open's read. `withConsent` accepts and then runs the
      // gated open, which is why both fire within milliseconds of each other.
      if (agentPanelStore.claimAcceptanceBillingRefresh(type.value, identity))
        return
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
