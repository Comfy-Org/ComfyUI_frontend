import type { BillingStatus } from '@comfyorg/ingest-types'
import { createSharedComposable, useTimestamp } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isWithinEnterpriseEndingNotice } from '@/platform/billing/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlanEnded } from '@/platform/billing/composables/usePlanEnded'
import { isTopUpDeniedPastDue } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export type BillingBannerKind =
  | 'paused'
  | 'planEnded'
  | 'outOfCredits'
  | 'ending'
  | 'planChange'

export type BillingBannerAudience = 'team' | 'personal'

export interface BillingBannerInputs {
  billingControlEnabled: boolean
  isTeamPlan: boolean
  isEnterprise: boolean
  isKnownPersonalTier: boolean
  isLoaded: boolean
  billingStatus: BillingStatus | null
  canAccessSubscriptionFeatures: boolean
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
  topUpDeniedPastDue: boolean
  runDeniedPastDue: boolean
  unifiedBillingSettingsEnabled: boolean
  isActive: boolean
}

// An Enterprise cancel_at is an agreed end date — an operator pilot term or
// a sales-mediated cancellation. The two are deliberately not distinguished:
// cancel_at alone cannot tell them apart (cloud's
// common/repository/billing/repository.go), and the rendering is truthful
// for both — quiet until the 14-day window, then the ending notice.
// Decision recorded on FE-2035. Enterprise payment and credit lifecycles
// are handled by sales, so outOfCredits never applies.
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

const PERSONAL_TIERS: ReadonlySet<SubscriptionTier> = new Set([
  'STANDARD',
  'CREATOR',
  'PRO',
  'FOUNDERS_EDITION'
])

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

function showsPastDueOutOfCredits(inputs: BillingBannerInputs): boolean {
  return (
    (inputs.topUpDeniedPastDue || inputs.runDeniedPastDue) &&
    inputs.hasFunds === false &&
    !inputs.outOfCreditsDismissed
  )
}

function cloudCreditBannersOpen(inputs: BillingBannerInputs): boolean {
  if (!inputs.unifiedBillingSettingsEnabled) return true
  return inputs.isActive
}

function deriveNoticeBanner(
  inputs: BillingBannerInputs,
  audience: BillingBannerAudience
): BillingBannerKind | null {
  if (!inputs.billingControlEnabled) return null
  const creditsOpen = cloudCreditBannersOpen(inputs)
  if (creditsOpen && showsPastDueOutOfCredits(inputs)) return 'outOfCredits'
  if (!inputs.canAccessSubscriptionFeatures) return null
  if (
    creditsOpen &&
    inputs.hasFunds === false &&
    !inputs.outOfCreditsDismissed
  ) {
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

export function deriveBillingBanner(
  inputs: BillingBannerInputs,
  now: number = Date.now()
): BillingBannerKind | null {
  if (inputs.billingStatus === 'paused') return 'paused'
  if (!inputs.isLoaded) return null
  const audience = billingBannerAudience(inputs)
  if (hasPlanEnded(inputs, audience)) {
    return inputs.planEndedDismissed ? null : 'planEnded'
  }
  if (inputs.isEnterprise) return deriveEnterpriseBanner(inputs, now)
  return audience ? deriveNoticeBanner(inputs, audience) : null
}

function classifyTier(
  tier: SubscriptionTier | null | undefined
): Pick<BillingBannerInputs, 'isEnterprise' | 'isKnownPersonalTier'> {
  return {
    isEnterprise: tier === 'ENTERPRISE',
    isKnownPersonalTier: tier != null && PERSONAL_TIERS.has(tier)
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
    subscription,
    isTeamPlan,
    billingStatus
  } = useBillingContext()
  const { permissions } = useWorkspaceUI()
  const { flags } = useFeatureFlags()
  const { topUpDenial, runDeniedPaymentPastDue } = useBillingCapabilities()

  const { isPlanEnded, isPlanTerminal } = usePlanEnded()
  const planEndedDismissed = ref(false)
  const outOfCreditsDismissed = ref(false)
  const planChangeDismissed = ref(false)

  const now = useTimestamp({ interval: 60_000 })

  const bannerInputs = computed<BillingBannerInputs>(() => ({
    billingControlEnabled: flags.billingControlEnabled,
    isTeamPlan: isTeamPlan.value,
    billingStatus: billingStatus.value,
    canAccessSubscriptionFeatures: canAccessSubscriptionFeatures.value,
    canManage: permissions.value.canManageSubscription,
    isPlanEnded: isPlanEnded.value,
    isPlanTerminal: isPlanTerminal.value,
    planEndedDismissed: planEndedDismissed.value,
    outOfCreditsDismissed: outOfCreditsDismissed.value,
    planChangeDismissed: planChangeDismissed.value,
    topUpDeniedPastDue: isTopUpDeniedPastDue(topUpDenial.value),
    runDeniedPastDue: runDeniedPaymentPastDue.value,
    unifiedBillingSettingsEnabled: flags.unifiedBillingSettingsEnabled,
    isActive: subscription.value?.isActive === true,
    ...readSubscriptionInputs(subscription.value)
  }))

  const kind = computed<BillingBannerKind | null>(() =>
    isCloud ? deriveBillingBanner(bannerInputs.value, now.value) : null
  )
  const audience = computed(() => billingBannerAudience(bannerInputs.value))

  const hasExhaustedFunds = computed(
    () => subscription.value?.hasFunds === false
  )
  watch(hasExhaustedFunds, (exhausted) => {
    if (!exhausted) outOfCreditsDismissed.value = false
  })

  function dismiss() {
    if (kind.value === 'planEnded') planEndedDismissed.value = true
    if (kind.value === 'outOfCredits') outOfCreditsDismissed.value = true
    if (kind.value === 'planChange') planChangeDismissed.value = true
  }

  return { kind, audience, dismiss }
}

export const useBillingBanner = createSharedComposable(useBillingBannerInternal)
