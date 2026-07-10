import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierCredits
} from '@/platform/cloud/subscription/constants/tierPricing'
import { computeMonthlyUsage } from '@/platform/cloud/subscription/utils/creditsProgress'

/**
 * Composable for handling subscription credit calculations and formatting.
 *
 * Uses useBillingContext which automatically selects the correct billing source:
 * - If team workspaces feature is disabled: uses legacy (/customers)
 * - If team workspaces feature is enabled:
 *   - Personal workspace: uses legacy (/customers)
 *   - Team workspace: uses workspace (/billing)
 */
/**
 * Formats a cent value to display credits.
 * Backend returns cents despite the *_micros naming convention.
 */
function formatBalance(maybeCents: number | undefined, locale: string): string {
  const cents = maybeCents ?? 0
  return formatCreditsFromCents({
    cents,
    locale,
    numberOptions: {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  })
}

export function useSubscriptionCredits() {
  const billingContext = useBillingContext()
  const { locale } = useI18n()

  const totalCredits = computed(() => {
    const balance = toValue(billingContext.balance)
    return formatBalance(balance?.amountMicros, locale.value)
  })

  const monthlyBonusCredits = computed(() => {
    const balance = toValue(billingContext.balance)
    return formatBalance(balance?.cloudCreditBalanceMicros, locale.value)
  })

  const prepaidCredits = computed(() => {
    const balance = toValue(billingContext.balance)
    return formatBalance(balance?.prepaidBalanceMicros, locale.value)
  })

  const isLoadingBalance = computed(() => toValue(billingContext.isLoading))

  const creditsFromMicros = (maybeCents: number | undefined): number =>
    centsToCredits(maybeCents ?? 0)

  const monthlyBonusCreditsValue = computed(() =>
    creditsFromMicros(toValue(billingContext.balance)?.cloudCreditBalanceMicros)
  )

  const prepaidCreditsValue = computed(() =>
    creditsFromMicros(toValue(billingContext.balance)?.prepaidBalanceMicros)
  )

  // Total credits granted for the current billing cycle. Team plans read the
  // credit stop; personal tiers read the tier grant. Annual plans front-load the
  // whole year, so multiply the monthly nominal by the cycle length.
  const cycleMonths = computed(() =>
    toValue(billingContext.subscription)?.duration === 'ANNUAL' ? 12 : 1
  )
  const allowanceTotalCredits = computed<number | null>(() => {
    const teamStop = toValue(billingContext.currentTeamCreditStop)
    const tier = toValue(billingContext.subscription)?.tier
    const tierKey = tier
      ? (TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY)
      : DEFAULT_TIER_KEY
    const monthly = teamStop
      ? teamStop.credits_monthly
      : getTierCredits(tierKey)
    return monthly === null ? null : monthly * cycleMonths.value
  })

  // Usage of that allowance drives the credits bar. Paused plans read as unused
  // (credits are frozen), so force it to zero.
  const usage = computed(() => {
    const base = computeMonthlyUsage(
      monthlyBonusCreditsValue.value,
      allowanceTotalCredits.value ?? 0
    )
    return toValue(billingContext.isPaused)
      ? { ...base, used: 0, usedFraction: 0 }
      : base
  })

  return {
    totalCredits,
    monthlyBonusCredits,
    prepaidCredits,
    monthlyBonusCreditsValue,
    prepaidCreditsValue,
    isLoadingBalance,
    allowanceTotalCredits,
    usage
  }
}
