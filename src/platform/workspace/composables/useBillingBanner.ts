import { createSharedComposable } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { isCloud } from '@/platform/distribution/types'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export type BillingBannerKind =
  | 'paused'
  | 'paymentFailed'
  | 'outOfCredits'
  | 'ending'

export interface BillingBannerInputs {
  isTeamPlan: boolean
  isLoaded: boolean
  isActiveSubscription: boolean
  billingStatus: BillingStatus | null
  hasFunds: boolean | null
  isCancelled: boolean
  endDate: string | null
  canManage: boolean
  outOfCreditsDismissed: boolean
}

// The single billing banner slot, in priority order: paused > paymentFailed >
// outOfCredits > ending. Gated on the team PLAN, not the workspace type: a team
// workspace can sit on a personal-tier legacy plan, and once consolidated
// billing lands a personal workspace can hold a team plan.
export function deriveBillingBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (!inputs.isTeamPlan || !inputs.isLoaded) return null

  // Both sit above the isActiveSubscription gate because the backend folds
  // billing_status into is_active: paused and payment_failed each report
  // is_active=false, so either check would be dead code below it.
  if (inputs.billingStatus === 'paused') return 'paused'
  if (inputs.billingStatus === 'payment_failed' && inputs.canManage) {
    return 'paymentFailed'
  }

  // Inactive workspaces surface a run-lock modal, not this banner. Members hit
  // this on payment_failed, which is per design — only billing managers see it.
  if (!inputs.isActiveSubscription) return null

  if (inputs.hasFunds === false && !inputs.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  if (inputs.isCancelled && inputs.endDate && inputs.canManage) {
    return 'ending'
  }

  return null
}

function useBillingBannerInternal() {
  const { isActiveSubscription, billingStatus, subscription, isTeamPlan } =
    useBillingContext()
  const { permissions } = useWorkspaceUI()

  const dismissed = ref(false)

  const kind = computed<BillingBannerKind | null>(() => {
    if (!isCloud) return null
    return deriveBillingBanner({
      isTeamPlan: isTeamPlan.value,
      isLoaded: subscription.value !== null,
      isActiveSubscription: isActiveSubscription.value,
      billingStatus: billingStatus.value,
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
