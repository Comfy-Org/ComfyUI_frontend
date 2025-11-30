import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

/**
 * Composable for handling subscription credit calculations and formatting
 */
export function useSubscriptionCredits() {
  const authStore = useFirebaseAuthStore()
  const { t, locale } = useI18n()

  const formatBalance = (maybeCents?: number) => {
    // Backend returns cents despite the *_micros naming convention.
    const cents = maybeCents ?? 0
    const amount = formatCreditsFromCents({
      cents,
      locale: locale.value
    })
    return `${amount} ${t('credits.credits')}`
  }

  const totalCredits = computed(() => {
    try {
      return formatBalance(authStore.balance?.amount_micros)
    } catch (error) {
      console.error(
        '[useSubscriptionCredits] Error formatting total credits:',
        error
      )
      return formatBalance(0)
    }
  })

  const monthlyBonusCredits = computed(() => {
    try {
      return formatBalance(authStore.balance?.cloud_credit_balance_micros)
    } catch (error) {
      console.error(
        '[useSubscriptionCredits] Error formatting monthly bonus credits:',
        error
      )
      return formatBalance(0)
    }
  })

  const prepaidCredits = computed(() => {
    try {
      return formatBalance(authStore.balance?.prepaid_balance_micros)
    } catch (error) {
      console.error(
        '[useSubscriptionCredits] Error formatting prepaid credits:',
        error
      )
      return formatBalance(0)
    }
  })

  const isLoadingBalance = computed(() => authStore.isFetchingBalance)

  return {
    totalCredits,
    monthlyBonusCredits,
    prepaidCredits,
    isLoadingBalance
  }
}
