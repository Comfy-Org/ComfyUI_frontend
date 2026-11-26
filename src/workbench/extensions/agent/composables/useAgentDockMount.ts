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

  /**
   * The acceptance read, through `fetchStatus({ fresh: true })` rather than
   * `fetchStatusFresh()`. `fresh` is what detaches a status request already in
   * flight instead of joining it, and the context's `fetchStatusFresh` forwards
   * no options -- so a read issued through it can answer with pre-acceptance
   * funds, which the open then inherits as if it were post-acceptance.
   *
   * Resolves true because the read settled, not because it was adopted:
   * `fetchStatus` discards that flag. That is the distinction the open needs
   * anyway. A read that settles un-adopted was superseded by a newer one or
   * belongs to a workspace the user has left, both of which leave the panel
   * holding something at least as fresh; a read that never lands shows up as
   * a rejection or as the registry's timeout, which the caller still sees.
   */
  const readBillingFresh = async (): Promise<boolean> => {
    await fetchStatus({ fresh: true })
    return true
  }

  watch(
    () => consentStore.confirmedAcceptances,
    (count) => {
      if (!count || count <= agentPanelStore.billingRefreshedAcceptances) return
      agentPanelStore.billingRefreshedAcceptances = count
      // Routing not known yet: `fetchStatus` owes the fresh read until it is,
      // and the keyed rail would drop it. Without `fetchStatusFresh` an open
      // issues no read of its own, so there is nothing to share with either.
      // Both ways, keep the direct call.
      if (fetchStatusFresh === undefined || type.value === 'unknown') {
        void fetchStatus({ fresh: true }).catch(reportBillingRefreshError)
        return
      }
      // Otherwise go through the shared refresh registry, so a host asking for
      // the same read joins this one instead of issuing a second, and hand it
      // to the panel open that this acceptance is about to trigger.
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

  /**
   * The fresh read an open owes when it has no acceptance read to inherit.
   * Keyed to the open's own epoch rather than to the current one, so the second
   * dock host and a retry after a failed acceptance read both join this read
   * instead of issuing another, and so a retry that arrives after the panel
   * closed is dropped.
   */
  function refreshOnOpen(identity: string, epoch: number): void {
    if (fetchStatusFresh === undefined) return
    if (!agentPanelStore.isOpen || agentPanelStore.panelOpenEpoch !== epoch)
      return
    void agentPanelStore
      .refreshBillingStatus(
        `${type.value}:${identity}:reopen:${epoch}`,
        fetchStatusFresh,
        true,
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
      // The acceptance that opened this panel already issued a fresh read, so
      // that read is this open's read. `withConsent` accepts and then runs the
      // gated open, which is why both fire within milliseconds of each other.
      const accepted = agentPanelStore.acceptanceBillingRefreshForOpen(
        type.value,
        identity
      )
      if (accepted) {
        // Unless it never landed. A read that rejects or hits the registry's
        // timeout leaves this open with no fresh billing status, and before the
        // read was shared every open had its own. The error is already
        // reported where the read was issued, so only the retry belongs here.
        void accepted.then(
          (adopted) => {
            if (!adopted) refreshOnOpen(identity, epoch)
          },
          () => refreshOnOpen(identity, epoch)
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
