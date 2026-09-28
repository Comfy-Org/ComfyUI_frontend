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
import type { SubscriptionInfo } from '@/composables/billing/types'
import type {
  SubscriptionTier,
  BillingStatus
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export type BillingBannerKind =
  | 'paused'
  | 'paymentFailed'
  | 'outOfCredits'
  | 'ending'
  | 'planChange'

export interface BillingBannerInputs {
  billingControlEnabled: boolean
  v1PaymentRecovery: boolean
  isTeamPlan: boolean
  isEnterprise: boolean
  isKnownPersonalTier: boolean
  isLoaded: boolean
  canAccessSubscriptionFeatures: boolean
  billingStatus: BillingStatus | null
  hasFunds: boolean | null
  isCancelled: boolean
  endDate: string | null
  canManage: boolean
  outOfCreditsDismissed: boolean
  hasScheduledChange: boolean
}

// An Enterprise cancel_at is an agreed end date — an operator pilot term or
// a sales-mediated cancellation. The two are deliberately not distinguished:
// cancel_at alone cannot tell them apart (cloud's
// common/repository/billing/repository.go), and the rendering is truthful
// for both — quiet until the 14-day window, then the ending notice.
// Decision recorded on FE-2035. Enterprise payment and credit lifecycles
// are handled by sales, so paused/paymentFailed/outOfCredits never apply.
function deriveEnterpriseBanner(
  inputs: BillingBannerInputs,
  now: number
): BillingBannerKind | null {
  if (!inputs.canAccessSubscriptionFeatures) return null
  if (!inputs.billingControlEnabled) return null
  const withinEndingNotice =
    inputs.isCancelled &&
    inputs.canManage &&
    isWithinEnterpriseEndingNotice(inputs.endDate, now)
  return withinEndingNotice ? 'ending' : null
}

// The personal tiers whose payment-recovery claim is known-good. An
// unrecognized server tier reads as "not team, not Enterprise" and would
// otherwise borrow the personal claim — the module's unknown-tier policy is
// fail-closed, so recovery is granted only to tiers on this list.
const PERSONAL_RECOVERY_TIERS: ReadonlySet<SubscriptionTier> = new Set([
  'STANDARD',
  'CREATOR',
  'PRO',
  'FOUNDERS_EDITION'
])

// Payment recovery reaches personal workspaces too; only paused stays
// team-shaped. Its rollout gate is independent of billing control.
function derivePaymentRecoveryBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (!inputs.v1PaymentRecovery) return null
  if (!inputs.isTeamPlan && !inputs.isKnownPersonalTier) return null
  if (inputs.isTeamPlan && inputs.billingStatus === 'paused') return 'paused'
  if (inputs.billingStatus === 'payment_failed' && inputs.canManage) {
    return 'paymentFailed'
  }
  return null
}

function teamNoticesApply(inputs: BillingBannerInputs): boolean {
  return (
    inputs.isTeamPlan &&
    inputs.canAccessSubscriptionFeatures &&
    inputs.billingControlEnabled
  )
}

// A self-serve cancellation is user-initiated news, so its ending notice
// shows at once. A scheduled change is suppressed while cancelled — the
// ending notice already owns that window.
function deriveLifecycleNotice(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (inputs.isCancelled && inputs.endDate && inputs.canManage) {
    return 'ending'
  }
  if (inputs.hasScheduledChange && !inputs.isCancelled) {
    return 'planChange'
  }
  return null
}

// The team-only billing-control notices. Any other tier (including
// unrecognized ones) gets no banner at all.
function deriveTeamNoticeBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (!teamNoticesApply(inputs)) return null
  if (inputs.hasFunds === false && !inputs.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  return deriveLifecycleNotice(inputs)
}

// The single billing banner slot, in priority order: paused > paymentFailed >
// outOfCredits > ending > planChange. The Enterprise policy takes precedence
// over any team-plan reading of the same subscription.
export function deriveBillingBanner(
  inputs: BillingBannerInputs,
  now: number = Date.now()
): BillingBannerKind | null {
  if (!inputs.isLoaded) return null
  if (inputs.isEnterprise) return deriveEnterpriseBanner(inputs, now)
  return derivePaymentRecoveryBanner(inputs) ?? deriveTeamNoticeBanner(inputs)
}

function classifyTier(
  tier: SubscriptionTier | null | undefined
): Pick<BillingBannerInputs, 'isEnterprise' | 'isKnownPersonalTier'> {
  return {
    isEnterprise: tier === 'ENTERPRISE',
    isKnownPersonalTier: tier != null && PERSONAL_RECOVERY_TIERS.has(tier)
  }
}

function readSubscriptionInputs(
  subscription: SubscriptionInfo | null
): Pick<
  BillingBannerInputs,
  | 'isEnterprise'
  | 'isKnownPersonalTier'
  | 'isLoaded'
  | 'hasFunds'
  | 'isCancelled'
  | 'endDate'
  | 'hasScheduledChange'
> {
  return {
    ...classifyTier(subscription?.tier),
    isLoaded: subscription !== null,
    hasFunds: subscription?.hasFunds ?? null,
    isCancelled: subscription?.isCancelled ?? false,
    endDate: subscription?.endDate ?? null,
    hasScheduledChange: subscription?.scheduledChange != null
  }
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

  const bannerInputs = computed<BillingBannerInputs>(() => ({
    billingControlEnabled: flags.billingControlEnabled,
    v1PaymentRecovery: flags.v1PaymentRecovery,
    isTeamPlan: isTeamPlan.value,
    canAccessSubscriptionFeatures: canAccessSubscriptionFeatures.value,
    billingStatus: billingStatus.value,
    canManage: permissions.value.canManageSubscription,
    outOfCreditsDismissed: dismissed.value,
    ...readSubscriptionInputs(subscription.value)
  }))

  const kind = computed<BillingBannerKind | null>(() =>
    isCloud ? deriveBillingBanner(bannerInputs.value, now.value) : null
  )

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
