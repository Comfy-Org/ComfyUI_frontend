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
import { usePlanEnded } from '@/platform/workspace/composables/usePlanEnded'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export type BillingBannerKind =
  | 'paused'
  | 'paymentFailed'
  | 'planEnded'
  | 'outOfCredits'
  | 'ending'
  | 'planChange'

export type BillingBannerAudience = 'team' | 'personal'

export interface BillingBannerInputs {
  billingControlEnabled: boolean
  v1PaymentRecovery: boolean
  isTeamPlan: boolean
  isEnterprise: boolean
  isKnownPersonalTier: boolean
  hasRenewalInvoice: boolean
  isInvoiceRecoverableTier: boolean
  isLoaded: boolean
  canAccessSubscriptionFeatures: boolean
  billingStatus: BillingStatus | null
  hasFunds: boolean | null
  isCancelled: boolean
  endDate: string | null
  canManage: boolean
  isPlanEnded: boolean
  isPlanTerminal: boolean
  planEndedDismissed: boolean
  outOfCreditsDismissed: boolean
  planChangeDismissed: boolean
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
    inputs.isCancelled && isWithinEnterpriseEndingNotice(inputs.endDate, now)
  return withinEndingNotice ? 'ending' : null
}

// The personal tiers whose payment-recovery claim is known-good. An
// unrecognized server tier reads as "not team, not Enterprise" and would
// otherwise borrow the personal claim — the module's unknown-tier policy is
// fail-closed, so recovery is granted only to tiers on this list. An
// outstanding renewal invoice also qualifies for FREE or no tier, which is how
// past-due legacy subscribers are reported; other unrecognized tiers stay out.
const PERSONAL_RECOVERY_TIERS: ReadonlySet<SubscriptionTier> = new Set([
  'STANDARD',
  'CREATOR',
  'PRO',
  'FOUNDERS_EDITION'
])

// Payment recovery reaches personal workspaces too. Its rollout gate is
// independent of billing control.
function derivePaymentRecoveryBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (!inputs.v1PaymentRecovery) return null
  if (
    !inputs.isTeamPlan &&
    !inputs.isKnownPersonalTier &&
    !(inputs.hasRenewalInvoice && inputs.isInvoiceRecoverableTier)
  ) {
    return null
  }
  if (inputs.billingStatus === 'paused') return 'paused'
  if (inputs.billingStatus === 'payment_failed') return 'paymentFailed'
  return null
}

// The self-serve plans the billing-control notices speak to. Enterprise and
// unrecognized tiers have no audience, so they fail closed to no notice.
function billingBannerAudience(
  inputs: Pick<
    BillingBannerInputs,
    'isTeamPlan' | 'isEnterprise' | 'isKnownPersonalTier'
  >
): BillingBannerAudience | null {
  if (inputs.isEnterprise) return null
  if (inputs.isTeamPlan) return 'team'
  return inputs.isKnownPersonalTier ? 'personal' : null
}

// A self-serve cancellation is user-initiated news, so its ending notice
// shows at once. A scheduled change is suppressed while cancelled — the
// ending notice already owns that window — and is owner-only. It has no
// personal design yet, so it stays team-only.
function deriveLifecycleNotice(
  inputs: BillingBannerInputs,
  audience: BillingBannerAudience
): BillingBannerKind | null {
  if (inputs.isCancelled && inputs.endDate) return 'ending'
  const showsPlanChange =
    audience === 'team' &&
    inputs.hasScheduledChange &&
    !inputs.isCancelled &&
    inputs.canManage &&
    !inputs.planChangeDismissed
  return showsPlanChange ? 'planChange' : null
}

function deriveNoticeBanner(
  inputs: BillingBannerInputs,
  audience: BillingBannerAudience
): BillingBannerKind | null {
  if (!inputs.canAccessSubscriptionFeatures) return null
  if (!inputs.billingControlEnabled) return null
  if (inputs.hasFunds === false && !inputs.outOfCreditsDismissed) {
    return 'outOfCredits'
  }
  return deriveLifecycleNotice(inputs, audience)
}

// usePlanEnded covers team and sales-managed plans only; a terminal personal
// plan is read here so the Members panel keeps its personal upsell.
function hasPlanEnded(
  inputs: BillingBannerInputs,
  audience: BillingBannerAudience | null
): boolean {
  return (
    inputs.isPlanEnded || (audience === 'personal' && inputs.isPlanTerminal)
  )
}

// The single billing banner slot, in priority order: paused > paymentFailed >
// planEnded > outOfCredits > ending > planChange. The Enterprise policy takes
// precedence over any team-plan reading of the same subscription. Plan ended
// ships without a rollout flag.
export function deriveBillingBanner(
  inputs: BillingBannerInputs,
  now: number = Date.now()
): BillingBannerKind | null {
  if (!inputs.isLoaded) return null
  const recovery = inputs.isEnterprise
    ? null
    : derivePaymentRecoveryBanner(inputs)
  if (recovery) return recovery
  const audience = billingBannerAudience(inputs)
  if (hasPlanEnded(inputs, audience)) {
    return inputs.planEndedDismissed ? null : 'planEnded'
  }
  if (inputs.isEnterprise) return deriveEnterpriseBanner(inputs, now)
  return audience ? deriveNoticeBanner(inputs, audience) : null
}

function classifyTier(
  tier: SubscriptionTier | null | undefined
): Pick<
  BillingBannerInputs,
  'isEnterprise' | 'isKnownPersonalTier' | 'isInvoiceRecoverableTier'
> {
  return {
    isEnterprise: tier === 'ENTERPRISE',
    isInvoiceRecoverableTier: tier == null || tier === 'FREE',
    isKnownPersonalTier: tier != null && PERSONAL_RECOVERY_TIERS.has(tier)
  }
}

function readSubscriptionInputs(
  subscription: SubscriptionInfo | null
): Pick<
  BillingBannerInputs,
  | 'isEnterprise'
  | 'isKnownPersonalTier'
  | 'isInvoiceRecoverableTier'
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
    renewalInvoice,
    fetchStatus,
    fetchBalance
  } = useBillingContext()
  const { permissions } = useWorkspaceUI()
  const { flags } = useFeatureFlags()

  const { isPlanEnded, isPlanTerminal } = usePlanEnded()
  const planEndedDismissed = ref(false)
  const outOfCreditsDismissed = ref(false)
  const planChangeDismissed = ref(false)

  // Coarse shared clock so the enterprise notice window opens mid-session
  // instead of waiting for an unrelated billing ref to change.
  const now = useTimestamp({ interval: 60_000 })

  const bannerInputs = computed<BillingBannerInputs>(() => ({
    billingControlEnabled: flags.billingControlEnabled,
    v1PaymentRecovery: flags.v1PaymentRecovery,
    isTeamPlan: isTeamPlan.value,
    hasRenewalInvoice: renewalInvoice.value != null,
    canAccessSubscriptionFeatures: canAccessSubscriptionFeatures.value,
    billingStatus: billingStatus.value,
    canManage: permissions.value.canManageSubscription,
    isPlanEnded: isPlanEnded.value,
    isPlanTerminal: isPlanTerminal.value,
    planEndedDismissed: planEndedDismissed.value,
    outOfCreditsDismissed: outOfCreditsDismissed.value,
    planChangeDismissed: planChangeDismissed.value,
    ...readSubscriptionInputs(subscription.value)
  }))

  const kind = computed<BillingBannerKind | null>(() =>
    isCloud ? deriveBillingBanner(bannerInputs.value, now.value) : null
  )
  const audience = computed(() => billingBannerAudience(bannerInputs.value))

  // Out-of-credits dismissal lasts one exhaustion episode: reset once the
  // workspace is funded again so a later exhaustion re-shows. Plan ended and
  // plan change dismissals last the session. Shared state, so both survive the settings
  // panel unmounting when the dialog closes.
  const hasExhaustedFunds = computed(
    () => subscription.value?.hasFunds === false
  )
  watch(hasExhaustedFunds, (exhausted) => {
    if (!exhausted) outOfCreditsDismissed.value = false
  })

  useEventListener(window, 'focus', () => {
    if (kind.value !== 'paymentFailed' && kind.value !== 'paused') return
    void Promise.allSettled([fetchStatus(), fetchBalance()])
  })

  function dismiss() {
    if (kind.value === 'planEnded') planEndedDismissed.value = true
    if (kind.value === 'outOfCredits') outOfCreditsDismissed.value = true
    if (kind.value === 'planChange') planChangeDismissed.value = true
  }

  return { kind, audience, dismiss }
}

export const useBillingBanner = createSharedComposable(useBillingBannerInternal)
