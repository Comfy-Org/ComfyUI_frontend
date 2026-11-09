import type { BillingStatus } from '@comfyorg/ingest-types'
import { createSharedComposable, useTimestamp } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { hasEndingNoticeStarted } from '@/platform/billing/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlanEnded } from '@/platform/billing/composables/usePlanEnded'
import { isTopUpDeniedPastDue } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'

export type BillingBannerKind =
  | 'paused'
  | 'planEnded'
  | 'outOfCredits'
  | 'ending'
  | 'planChange'

export type BillingBannerAudience = 'team' | 'personal'

export type EnterpriseEndingNotice = 'scheduled' | 'started'

export interface BillingBannerInputs {
  billingControlEnabled: boolean
  audience: BillingBannerAudience | null
  enterpriseEndingNotice: EnterpriseEndingNotice | null
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

function deriveEnterpriseBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (!inputs.canAccessSubscriptionFeatures) return null
  if (!inputs.billingControlEnabled) return null
  return inputs.enterpriseEndingNotice === 'started' ? 'ending' : null
}

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

function hasPlanEnded(
  inputs: BillingBannerInputs,
  audience: BillingBannerAudience | null
): boolean {
  return (
    inputs.isPlanEnded || (audience === 'personal' && inputs.isPlanTerminal)
  )
}

export function deriveBillingBanner(
  inputs: BillingBannerInputs
): BillingBannerKind | null {
  if (inputs.billingStatus === 'paused') return 'paused'
  if (!inputs.isLoaded) return null
  const { audience } = inputs
  if (hasPlanEnded(inputs, audience)) {
    return inputs.planEndedDismissed ? null : 'planEnded'
  }
  if (inputs.enterpriseEndingNotice) return deriveEnterpriseBanner(inputs)
  return audience ? deriveNoticeBanner(inputs, audience) : null
}

function toBannerAudience(
  served: 'none' | BillingBannerAudience | null
): BillingBannerAudience | null {
  return served === 'none' ? null : served
}

function toEnterpriseEndingNotice(
  startsAt: string | null,
  now: number
): EnterpriseEndingNotice | null {
  if (!startsAt) return null
  return hasEndingNoticeStarted(startsAt, now) ? 'started' : 'scheduled'
}

function readSubscriptionInputs(
  subscription: SubscriptionInfo | null
): Pick<
  BillingBannerInputs,
  'isLoaded' | 'hasFunds' | 'isCancelled' | 'endDate' | 'hasScheduledChange'
> {
  return {
    isLoaded: subscription !== null,
    hasFunds: subscription?.hasFunds ?? null,
    isCancelled: subscription?.isCancelled ?? false,
    endDate: subscription?.endDate ?? null,
    hasScheduledChange: subscription?.scheduledChange != null
  }
}

function useBillingBannerInternal() {
  const { canAccessSubscriptionFeatures, subscription, billingStatus } =
    useBillingContext()
  const { permissions } = useBillingUI()
  const { flags } = useFeatureFlags()
  const {
    topUpDenial,
    runDeniedPaymentPastDue,
    billingNoticeAudience,
    endingNoticeStartsAt
  } = useBillingCapabilities()

  const { isPlanEnded, isPlanTerminal } = usePlanEnded()
  const planEndedDismissed = ref(false)
  const outOfCreditsDismissed = ref(false)
  const planChangeDismissed = ref(false)

  const now = useTimestamp({ interval: 60_000 })

  const bannerInputs = computed<BillingBannerInputs>(() => ({
    billingControlEnabled: flags.billingControlEnabled,
    audience: toBannerAudience(billingNoticeAudience.value),
    enterpriseEndingNotice: toEnterpriseEndingNotice(
      endingNoticeStartsAt.value,
      now.value
    ),
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
    isCloud ? deriveBillingBanner(bannerInputs.value) : null
  )
  const lifecycleKind = computed<BillingBannerKind | null>(() =>
    isCloud
      ? deriveBillingBanner({
          ...bannerInputs.value,
          hasFunds: true,
          topUpDeniedPastDue: false,
          runDeniedPastDue: false,
          planEndedDismissed: false,
          planChangeDismissed: false
        })
      : null
  )
  const audience = computed(() => bannerInputs.value.audience)

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

  return { kind, lifecycleKind, audience, dismiss }
}

export const useBillingBanner = createSharedComposable(useBillingBannerInternal)
