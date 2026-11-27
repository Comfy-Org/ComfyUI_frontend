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

  const readBillingFresh = async (): Promise<boolean> => {
    await fetchStatus({ fresh: true })
    return true
  }

  watch(
    () => consentStore.confirmedAcceptances,
    (count) => {
      if (!count || count <= agentPanelStore.billingRefreshedAcceptances) return
      agentPanelStore.billingRefreshedAcceptances = count
      if (fetchStatusFresh === undefined || type.value === 'unknown') {
        void fetchStatus({ fresh: true }).catch(reportBillingRefreshError)
        return
      }
      const identity = billingIdentity.value
      const read = agentPanelStore.refreshBillingStatus(
        acceptanceRefreshKey(type.value, identity, count),
        readBillingFresh,
        false,
        reportBillingRefreshError
      )
      agentPanelStore.recordAcceptanceBillingRefresh(type.value, identity, read)
      void read.catch(reportBillingRefreshError)
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

  function refreshOnOpen(
    identity: string,
    epoch: number,
    afterCurrent = true
  ): void {
    if (fetchStatusFresh === undefined) return
    if (!agentPanelStore.isOpen || agentPanelStore.panelOpenEpoch !== epoch)
      return
    void agentPanelStore
      .refreshBillingStatus(
        `${type.value}:${identity}:reopen:${epoch}`,
        fetchStatusFresh,
        afterCurrent,
        reportBillingRefreshError
      )
      .catch(reportBillingRefreshError)
  }

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
      const epoch = agentPanelStore.panelOpenEpoch
      const accepted = agentPanelStore.acceptanceBillingRefreshForOpen(
        type.value,
        identity
      )
      if (accepted) {
        void accepted.then(
          (adopted) => {
            if (!adopted) refreshOnOpen(identity, epoch, false)
          },
          () => refreshOnOpen(identity, epoch, false)
        )
        return
      }
      refreshOnOpen(identity, epoch)
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
