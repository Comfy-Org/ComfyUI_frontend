import { createSharedComposable } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { isCloud } from '@/platform/distribution/types'
import type {
  BillingStatus,
  BillingSubscriptionStatus
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export type BillingBannerKind =
  | 'paused'
  | 'paymentFailed'
  | 'outOfCredits'
  | 'ending'

export interface BillingBannerInputs {
  isTeamWorkspace: boolean
  isLoaded: boolean
  isActiveSubscription: boolean
  billingStatus: BillingStatus | null
  subscriptionStatus: BillingSubscriptionStatus | null
  hasFunds: boolean | null
  isCancelled: boolean
  endDate: string | null
  canManage: boolean
  outOfCreditsDismissed: boolean
}

// The single billing banner slot, in priority order: paused > paymentFailed >
// outOfCredits > ending. Owner-only states fall through for members; paused and
// outOfCredits stay visible to members with their own copy. A null subscription
// (not yet loaded) or a non-team workspace yields no banner.
export function deriveBillingBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (!inputs.isTeamWorkspace || !inputs.isLoaded) return null

  if (inputs.subscriptionStatus === 'paused') return 'paused'

  // Inactive workspaces surface a run-lock modal, not this banner.
  if (!inputs.isActiveSubscription) return null

  // Owner-only states keep their `canManage` gate in the condition so a member
  // falls through to the next state (e.g. out of credits) instead of stopping.
  if (inputs.billingStatus === 'payment_failed' && inputs.canManage) {
    return 'paymentFailed'
  }
  if (inputs.hasFunds === false && !inputs.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  if (inputs.isCancelled && inputs.endDate && inputs.canManage) {
    return 'ending'
  }

  return null
}

function useBillingBannerInternal() {
  const {
    isActiveSubscription,
    billingStatus,
    subscriptionStatus,
    subscription
  } = useBillingContext()
  const { workspaceType, permissions } = useWorkspaceUI()

  const dismissed = ref(false)

  const kind = computed<BillingBannerKind | null>(() => {
    if (!isCloud) return null
    return deriveBillingBanner({
      isTeamWorkspace: workspaceType.value === 'team',
      isLoaded: subscription.value !== null,
      isActiveSubscription: isActiveSubscription.value,
      billingStatus: billingStatus.value,
      subscriptionStatus: subscriptionStatus.value,
      hasFunds: subscription.value?.hasFunds ?? null,
      isCancelled: subscription.value?.isCancelled ?? false,
      endDate: subscription.value?.endDate ?? null,
      canManage: permissions.value.canManageSubscription,
      outOfCreditsDismissed: dismissed.value
    })
  })

  // Dismiss silences only the out-of-credits banner, and only for the current
  // exhaustion episode: reset once the workspace is funded again so a later
  // exhaustion re-shows. Shared across every banner mount (graph + linear).
  const hasExhaustedFunds = computed(
    () => subscription.value?.hasFunds === false
  )
  watch(hasExhaustedFunds, (exhausted) => {
    if (!exhausted) dismissed.value = false
  })

  function dismiss() {
    dismissed.value = true
  }

  return { kind, dismiss }
}

export const useBillingBanner = createSharedComposable(useBillingBannerInternal)
