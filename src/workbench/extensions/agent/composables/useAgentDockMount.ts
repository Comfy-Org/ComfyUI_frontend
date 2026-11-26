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
  const { subscription, fetchStatus } = useBillingContext()

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
  watch(
    () => consentStore.confirmedAcceptances,
    (count) => {
      if (!count || count <= agentPanelStore.billingRefreshedAcceptances) return
      agentPanelStore.billingRefreshedAcceptances = count
      void fetchStatus({ fresh: true }).catch((error: unknown) => {
        reportError(error, {
          surface: 'agent',
          errorType: 'error_refreshing_agent_billing_status'
        })
      })
    },
    { immediate: true, flush: 'sync' }
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
