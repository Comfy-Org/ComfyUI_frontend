import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type {
  BillingStatus,
  BillingSubscriptionStatus
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export function isAutoReloadFrozen(
  billingStatus: BillingStatus | null,
  subscriptionStatus: BillingSubscriptionStatus | null
) {
  return (
    billingStatus === 'paused' ||
    billingStatus === 'inactive' ||
    subscriptionStatus === 'ended'
  )
}

export function useAutoReloadAccess() {
  const { flags } = useFeatureFlags()
  const { billingStatus, subscriptionStatus } = useBillingContext()
  const { permissions } = useWorkspaceUI()

  const canAccessNow = () =>
    flags.billingControlEnabled && permissions.value.canManageSubscription
  const isFrozenNow = () =>
    isAutoReloadFrozen(billingStatus.value, subscriptionStatus.value)
  const canConfigureNow = () => canAccessNow() && !isFrozenNow()

  const canAccess = computed(canAccessNow)
  const isFrozen = computed(isFrozenNow)
  const canConfigure = computed(canConfigureNow)

  return {
    canAccess,
    isFrozen,
    canConfigure,
    canConfigureNow
  }
}
