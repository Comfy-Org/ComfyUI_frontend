import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import { useBillingContext } from '@/composables/billing/useBillingContext'

/**
 * Stands in for a credit figure the client does not know, as opposed to one it
 * knows to be zero. Matches the unknown-pool-total treatment already used for
 * the monthly credit pool in `CreditsTile.vue`.
 */
export const UNKNOWN_CREDITS_PLACEHOLDER = '—'

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

  const isLoadingBalance = computed(() => toValue(billingContext.isLoading))

  /**
   * A null balance means no read has landed: a page load whose balance request
   * failed leaves it null until a later read succeeds. Formatting that as `0`
   * tells the user their whole balance is gone while the ledger is untouched,
   * so the display figures stay null and the surfaces render an unavailable
   * state instead (FE-3164). A *present* balance with a missing field is still
   * a known zero and still formats as `0`.
   *
   * Excludes the window where a read is still in flight: a balance that is
   * null only because nobody has answered yet is pending, not unavailable, and
   * calling it unavailable swaps the loading skeletons for a definitive "the
   * figure is unknown" claim before the first response arrives.
   */
  const isBalanceUnavailable = computed(
    () => toValue(billingContext.balance) == null && !isLoadingBalance.value
  )

  const totalCredits = computed(() => {
    const balance = toValue(billingContext.balance)
    if (!balance) return null
    return formatBalance(balance.amountMicros, locale.value)
  })

  const monthlyBonusCredits = computed(() => {
    const balance = toValue(billingContext.balance)
    if (!balance) return null
    return formatBalance(balance.cloudCreditBalanceMicros, locale.value)
  })

  const prepaidCredits = computed(() => {
    const balance = toValue(billingContext.balance)
    if (!balance) return null
    return formatBalance(balance.prepaidBalanceMicros, locale.value)
  })

  const creditsFromMicros = (maybeCents: number | undefined): number =>
    centsToCredits(maybeCents ?? 0)

  const monthlyBonusCreditsValue = computed(() =>
    creditsFromMicros(toValue(billingContext.balance)?.cloudCreditBalanceMicros)
  )

  const prepaidCreditsValue = computed(() =>
    creditsFromMicros(toValue(billingContext.balance)?.prepaidBalanceMicros)
  )

  return {
    totalCredits,
    monthlyBonusCredits,
    prepaidCredits,
    monthlyBonusCreditsValue,
    prepaidCreditsValue,
    isLoadingBalance,
    isBalanceUnavailable
  }
}
