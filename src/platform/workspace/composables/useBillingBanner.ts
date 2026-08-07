import { createSharedComposable, useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
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
// outOfCredits > ending. Payment recovery and the existing billing-control
// notices have independent rollout gates.
export function deriveBillingBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (!inputs.isTeamPlan || !inputs.isLoaded) {
    return null
  }

  if (inputs.billingControlEnabled || inputs.v1PaymentRecovery) {
    if (inputs.billingStatus === 'paused') return 'paused'
    if (inputs.billingStatus === 'payment_failed' && inputs.canManage) {
      return 'paymentFailed'
    }
  }

  if (!inputs.isActiveSubscription) return null
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
    isActiveSubscription,
    billingStatus,
    subscription,
    isTeamPlan,
    fetchStatus,
    fetchBalance
  } = useBillingContext()
  const { permissions } = useWorkspaceUI()
  const { flags } = useFeatureFlags()

  const dismissed = ref(false)
  let paymentRefreshController: AbortController | null = null

  const kind = computed<BillingBannerKind | null>(() => {
    if (!isCloud) return null
    return deriveBillingBanner({
      billingControlEnabled: flags.billingControlEnabled,
      v1PaymentRecovery: flags.v1PaymentRecovery,
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
  // exhaustion re-shows. Shared state, so it survives the settings panel
  // unmounting when the dialog closes.
  const hasExhaustedFunds = computed(
    () => subscription.value?.hasFunds === false
  )
  watch(hasExhaustedFunds, (exhausted) => {
    if (!exhausted) dismissed.value = false
  })

  watch(
    () => flags.v1PaymentRecovery,
    (enabled) => {
      if (enabled) return
      paymentRefreshController?.abort()
      paymentRefreshController = null
    }
  )

  onScopeDispose(() => {
    paymentRefreshController?.abort()
    paymentRefreshController = null
  })

  useEventListener(window, 'focus', () => {
    if (!flags.v1PaymentRecovery || kind.value !== 'paymentFailed') return

    paymentRefreshController?.abort()
    const controller = new AbortController()
    paymentRefreshController = controller
    void Promise.allSettled([
      fetchStatus(controller.signal),
      fetchBalance(controller.signal)
    ]).finally(() => {
      if (paymentRefreshController === controller) {
        paymentRefreshController = null
      }
    })
  })

  function dismiss() {
    dismissed.value = true
  }

  return { kind, dismiss }
}

export const useBillingBanner = createSharedComposable(useBillingBannerInternal)
