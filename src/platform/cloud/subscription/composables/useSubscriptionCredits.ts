import { computed } from 'vue'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

/**
 * Composable for handling subscription credit calculations and formatting
 */
export function useSubscriptionCredits() {
  const authStore = useFirebaseAuthStore()

  const totalCredits = computed(() => {
    if (!authStore.balance?.amount_micros) return '0.00'
    try {
      return formatMetronomeCurrency(authStore.balance.amount_micros, 'usd')
    } catch (error) {
      console.error(
        '[useSubscriptionCredits] Error formatting total credits:',
        error
      )
      return '0.00'
    }
  })

  const monthlyBonusCredits = computed(() => {
    const balance = authStore.balance as any
    if (!balance?.cloud_credit_balance_micros) return '0.00'
    try {
      return formatMetronomeCurrency(balance.cloud_credit_balance_micros, 'usd')
    } catch (error) {
      console.error(
        '[useSubscriptionCredits] Error formatting monthly bonus credits:',
        error
      )
      return '0.00'
    }
  })

  const prepaidCredits = computed(() => {
    const balance = authStore.balance as any
    if (!balance?.prepaid_balance_micros) return '0.00'
    try {
      return formatMetronomeCurrency(balance.prepaid_balance_micros, 'usd')
    } catch (error) {
      console.error(
        '[useSubscriptionCredits] Error formatting prepaid credits:',
        error
      )
      return '0.00'
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
