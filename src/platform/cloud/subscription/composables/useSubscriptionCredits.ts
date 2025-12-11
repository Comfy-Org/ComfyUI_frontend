import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

/**
 * Composable for handling subscription credit calculations and formatting
 */
export function useSubscriptionCredits() {
  const authStore = useFirebaseAuthStore()
  const { locale } = useI18n()

  const formatBalance = (maybeCents?: number) => {
    // Backend returns cents despite the *_micros naming convention.
    const cents = maybeCents ?? 0
    const amount = formatCreditsFromCents({
      cents,
      locale: locale.value,
      numberOptions: {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }
    })
    return amount
  }

  const totalCredits = computed(() =>
    formatBalance(authStore.balance?.amount_micros)
  )

  const monthlyBonusCredits = computed(() =>
    formatBalance(authStore.balance?.cloud_credit_balance_micros)
  )

  const prepaidCredits = computed(() =>
    formatBalance(authStore.balance?.prepaid_balance_micros)
  )

  const isLoadingBalance = computed(() => authStore.isFetchingBalance)

  return {
    totalCredits,
    monthlyBonusCredits,
    prepaidCredits,
    isLoadingBalance
  }
}
