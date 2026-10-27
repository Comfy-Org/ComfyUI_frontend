import { createSharedComposable } from '@vueuse/core'
import { computed } from 'vue'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { isCloud } from '@/platform/distribution/types'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'

function useBillingUIInternal() {
  const workspace = useWorkspaceIdentity()
  const billingState = useWorkspaceBillingStateStore()
  const { canAccessSubscriptionFeatures, isTeamPlan, subscription } =
    useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const {
    canReactivate,
    canSubscribeSelfServe,
    snapshotAuthoritative,
    canManageSubscription,
    canDowngradeToPersonal
  } = useBillingCapabilities()

  const permissions = computed(() => ({
    canManageSubscription: canManageSubscription.value,
    canManageSubscriptionLifecycle: canManageSubscription.value,
    canDowngradeToPersonal: canDowngradeToPersonal.value
  }))
  const canReactivatePlan = computed<boolean>(() =>
    pendingServerFact(
      'BE-23885',
      isCloud && shouldUseWorkspaceBilling.value
        ? canReactivate.value
        : canManageSubscription.value
    )
  )
  const canOpenPricingSurface = computed<boolean>(() =>
    pendingServerFact(
      'BE-23885',
      isCloud && shouldUseWorkspaceBilling.value && snapshotAuthoritative.value
        ? canSubscribeSelfServe.value
        : canManageSubscription.value
    )
  )
  const isSubscriptionCancelled = computed(
    () => subscription.value?.isCancelled ?? false
  )

  return {
    permissions,
    canReactivatePlan,
    canOpenPricingSurface,
    workspaceType: computed(
      () => workspace.activeWorkspace?.type ?? 'personal'
    ),
    isInPersonalWorkspace: computed(() => workspace.isInPersonalWorkspace),
    isWorkspaceSubscribed: computed(() => billingState.isWorkspaceSubscribed),
    canAccessSubscriptionFeatures,
    isSubscriptionCancelled,
    isTeamPlanCancelled: computed(
      () => isTeamPlan.value && isSubscriptionCancelled.value
    )
  }
}

export const useBillingUI = createSharedComposable(useBillingUIInternal)
