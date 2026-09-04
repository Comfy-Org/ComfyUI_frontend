import {
  createSharedComposable,
  useEventListener,
  useTimestamp
} from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isWithinEnterpriseEndingNotice } from '@/platform/cloud/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export type BillingBannerKind =
  | 'paused'
  | 'paymentFailed'
  | 'outOfCredits'
  | 'ending'

export interface BillingBannerInputs {
  billingControlEnabled: boolean
  v1PaymentRecovery: boolean
  isTeamPlan: boolean
  isEnterprise: boolean
  isLoaded: boolean
  canAccessSubscriptionFeatures: boolean
  billingStatus: BillingStatus | null
  hasFunds: boolean | null
  isCancelled: boolean
  endDate: string | null
  canManage: boolean
  outOfCreditsDismissed: boolean
}

// The single billing banner slot, in priority order: paused > paymentFailed >
// outOfCredits > ending. Payment recovery and the existing billing-control
// notices have independent rollout gates.
export function deriveBillingBanner(
  inputs: BillingBannerInputs,
  now: number = Date.now()
): BillingBannerKind | null {
  if (!inputs.isLoaded) return null

  // An Enterprise workspace surfaces exactly one banner: the ending notice,
  // and only once the sales-set end date is near. Its payment and credit
  // lifecycles are handled by sales, so paused/paymentFailed/outOfCredits
  // never apply — this branch takes precedence over any team-plan reading of
  // the same subscription.
  if (inputs.isEnterprise) {
    if (!inputs.canAccessSubscriptionFeatures) return null
    if (!inputs.billingControlEnabled) return null
    if (
      inputs.isCancelled &&
      inputs.endDate &&
      inputs.canManage &&
      isWithinEnterpriseEndingNotice(inputs.endDate, now)
    ) {
      return 'ending'
    }
    return null
  }

  // Everything below is the self-serve team path, unchanged: a cancellation
  // there is user-initiated news, so the ending notice shows at once. Any
  // other tier (including unrecognized ones) gets no banner at all.
  if (!inputs.isTeamPlan) return null

  if (inputs.v1PaymentRecovery) {
    if (inputs.billingStatus === 'paused') return 'paused'
    if (inputs.billingStatus === 'payment_failed' && inputs.canManage) {
      return 'paymentFailed'
    }
  }

  if (!inputs.canAccessSubscriptionFeatures) return null
  if (!inputs.billingControlEnabled) return null

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
    canAccessSubscriptionFeatures,
    billingStatus,
    subscription,
    isTeamPlan,
    fetchStatus,
    fetchBalance
  } = useBillingContext()
  const { permissions } = useWorkspaceUI()
  const { flags } = useFeatureFlags()

  const dismissed = ref(false)

  // Coarse shared clock so the enterprise notice window opens mid-session
  // instead of waiting for an unrelated billing ref to change.
  const now = useTimestamp({ interval: 60_000 })

  const kind = computed<BillingBannerKind | null>(() => {
    if (!isCloud) return null
    return deriveBillingBanner(
      {
        billingControlEnabled: flags.billingControlEnabled,
        v1PaymentRecovery: flags.v1PaymentRecovery,
        isTeamPlan: isTeamPlan.value,
        isEnterprise: subscription.value?.tier === 'ENTERPRISE',
        isLoaded: subscription.value !== null,
        canAccessSubscriptionFeatures: canAccessSubscriptionFeatures.value,
        billingStatus: billingStatus.value,
        hasFunds: subscription.value?.hasFunds ?? null,
        isCancelled: subscription.value?.isCancelled ?? false,
        endDate: subscription.value?.endDate ?? null,
        canManage: permissions.value.canManageSubscription,
        outOfCreditsDismissed: dismissed.value
      },
      now.value
    )
  })

  // Dismiss silences only the out-of-credits banner, and only for the current
  // exhaustion episode: reset once the workspace is funded again so a later
  // exhaustion re-shows. Shared state, so it survives the settings panel
  // unmounting when the dialog closes.
  const hasExhaustedFunds = computed(
    () => subscription.value?.hasFunds === false
  )
  watch(hasExhaustedFunds, (exhausted) => {
    if (!exhausted) dismissed.value = false
  })

  useEventListener(window, 'focus', () => {
    if (kind.value !== 'paymentFailed') return
    void Promise.allSettled([fetchStatus(), fetchBalance()])
  })

  function dismiss() {
    dismissed.value = true
  }

  return { kind, dismiss }
}

export const useBillingBanner = createSharedComposable(useBillingBannerInternal)
