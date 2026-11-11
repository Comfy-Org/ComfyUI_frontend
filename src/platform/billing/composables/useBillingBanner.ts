import { createSharedComposable, useTimestamp } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { deriveBillingStatusBanner } from '@comfyorg/account-core/billing'
import type {
  BillingStatusBannerAudience,
  BillingStatusBannerFacts,
  BillingStatusBannerKind,
  EnterpriseEndingNotice
} from '@comfyorg/account-core/billing'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  hasEndingNoticeStarted,
  isWithinEnterpriseEndingNotice
} from '@/platform/billing/subscription/constants/tierPricing'
import { isCloud } from '@/platform/distribution/types'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlanEnded } from '@/platform/billing/composables/usePlanEnded'
import { isTopUpDeniedPastDue } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

function toBannerAudience(
  served: 'none' | BillingStatusBannerAudience | null
): BillingStatusBannerAudience | null {
  return served === 'none' ? null : served
}

const PERSONAL_TIERS: ReadonlySet<NonNullable<SubscriptionInfo['tier']>> =
  new Set(['STANDARD', 'CREATOR', 'PRO', 'FOUNDERS_EDITION'])

function legacyBannerAudience(
  tier: SubscriptionInfo['tier'] | undefined,
  isTeamPlan: boolean
): BillingStatusBannerAudience | null {
  if (pendingServerFact('BE-25244', tier === 'ENTERPRISE')) return null
  if (pendingServerFact('BE-25244', isTeamPlan)) return 'team'
  return pendingServerFact('BE-25244', tier != null && PERSONAL_TIERS.has(tier))
    ? 'personal'
    : null
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
  BillingStatusBannerFacts,
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
  const {
    canAccessSubscriptionFeatures,
    subscription,
    billingStatus,
    isTeamPlan
  } = useBillingContext()
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

  const enterpriseEndingNotice = computed<EnterpriseEndingNotice | null>(() => {
    if (flags.billingNewUxEnabled) {
      return toEnterpriseEndingNotice(endingNoticeStartsAt.value, now.value)
    }
    if (
      !pendingServerFact('BE-25244', subscription.value?.tier === 'ENTERPRISE')
    ) {
      return null
    }
    return pendingServerFact(
      'BE-25244',
      subscription.value?.isCancelled &&
        isWithinEnterpriseEndingNotice(subscription.value.endDate, now.value)
    )
      ? 'started'
      : 'scheduled'
  })

  const bannerInputs = computed<BillingStatusBannerFacts>(() => ({
    billingControlEnabled: flags.billingControlEnabled,
    audience: flags.billingNewUxEnabled
      ? toBannerAudience(billingNoticeAudience.value)
      : legacyBannerAudience(subscription.value?.tier, isTeamPlan.value),
    enterpriseEndingNotice: enterpriseEndingNotice.value,
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

  const kind = computed<BillingStatusBannerKind | null>(() =>
    isCloud ? deriveBillingStatusBanner(bannerInputs.value) : null
  )
  const lifecycleKind = computed<BillingStatusBannerKind | null>(() =>
    isCloud
      ? deriveBillingStatusBanner({
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
